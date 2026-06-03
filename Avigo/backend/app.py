import os
import sqlite3
import bcrypt
import json
from urllib.parse import quote_plus
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))


def get_env(name, default=''):
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value

DB_PATH = get_env('DB_PATH', 'tripplanner.db')
GOOGLE_API_KEY = get_env('GOOGLE_API_KEY', 'YOUR_GOOGLE_API_KEY')
APP_HOST = get_env('APP_HOST', 'http://localhost:5000')

# Debug prints
print("=== ENVIRONMENT VARIABLES ===")
print(f"APP_HOST: {APP_HOST}")
print("=============================")

app = Flask(__name__)
CORS(app)

# DB initialization
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            status TEXT DEFAULT 'pending'
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# Helpers
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, password_hash):
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def send_admin_email(user_email):
    approve_url = f"{APP_HOST}/approve-user?email={user_email}"
    reject_url = f"{APP_HOST}/reject-user?email={user_email}"

    print(
        f"""
New user signup:

Email: {user_email}

Approve:
{approve_url}

Reject:
{reject_url}
"""
    )


def build_maps_url(name, address=''):
    query = ' '.join(part for part in [name, address] if part)
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"


def build_maps_url_from_coords(lat, lng):
    return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"


def haversine_km(lat1, lon1, lat2, lon2):
    from math import asin, cos, radians, sin, sqrt

    radius_km = 6371.0
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)

    a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return radius_km * c


def place_coordinates_from_text(location_text):
    coords = geocode_text_nominatim(location_text)
    if not coords:
        return None
    return {'lat': coords['lat'], 'lng': coords['lng']}


def geocode_text_nominatim(query):
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': query,
        'format': 'jsonv2',
        'limit': 1,
    }
    headers = {
        'User-Agent': 'AvigoTripPlanner/1.0 (local dev)',
    }

    response = requests.get(url, params=params, headers=headers, timeout=20)
    response.raise_for_status()
    payload = response.json()
    if not payload:
        return None

    item = payload[0]
    return {
        'lat': float(item.get('lat')),
        'lng': float(item.get('lon')),
        'display_name': item.get('display_name', query),
    }


def fetch_places_overpass(location, place_query, limit=5):
    center = geocode_text_nominatim(location)
    if not center:
        return []

    amenity_map = {
        'hotel': ['tourism~"hotel|hostel|guest_house|motel"'],
        'restaurant': ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'],
        'police station': ['amenity=police'],
        'hospital': ['amenity=hospital', 'amenity=clinic'],
        'tourist attraction': ['tourism=attraction', 'tourism=museum'],
    }
    tags = amenity_map.get(place_query, ['amenity=restaurant'])

    around = 6000
    query_parts = []
    for tag in tags:
        if '=' in tag and '~' not in tag:
            key, value = tag.split('=', 1)
            query_parts.append(f'node["{key}"="{value}"](around:{around},{center["lat"]},{center["lng"]});')
            query_parts.append(f'way["{key}"="{value}"](around:{around},{center["lat"]},{center["lng"]});')
        else:
            key, regex = tag.split('~', 1)
            query_parts.append(f'node["{key}"~{regex}](around:{around},{center["lat"]},{center["lng"]});')
            query_parts.append(f'way["{key}"~{regex}](around:{around},{center["lat"]},{center["lng"]});')

    overpass_query = f"""
    [out:json][timeout:25];
    (
      {' '.join(query_parts)}
    );
    out center tags;
    """

    overpass_endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
    ]

    payload = {'elements': []}
    for endpoint in overpass_endpoints:
        try:
            response = requests.post(
                endpoint,
                data=overpass_query,
                headers={'User-Agent': 'AvigoTripPlanner/1.0 (local dev)'},
                timeout=30,
            )
            if response.status_code in (429, 502, 503, 504):
                continue
            response.raise_for_status()
            payload = response.json()
            break
        except requests.RequestException:
            continue

    places = []
    for item in payload.get('elements', [])[:limit]:
        tags = item.get('tags', {}) or {}
        lat = item.get('lat', item.get('center', {}).get('lat'))
        lng = item.get('lon', item.get('center', {}).get('lon'))
        if lat is None or lng is None:
            continue

        name = tags.get('name') or tags.get('brand') or tags.get('operator') or 'Unnamed Place'
        address_bits = [
            tags.get('addr:housenumber', ''),
            tags.get('addr:street', ''),
            tags.get('addr:city', ''),
        ]
        address = ', '.join(bit for bit in address_bits if bit).strip(', ') or center.get('display_name', location)

        places.append({
            'id': str(item.get('id')),
            'name': name,
            'rating': None,
            'address': address,
            'location': {
                'lat': lat,
                'lng': lng,
            },
            'maps_url': build_maps_url_from_coords(lat, lng),
            'googleMapsUri': build_maps_url_from_coords(lat, lng),
            'map': build_maps_url_from_coords(lat, lng),
            'price_level': None,
            'primary_type': place_query,
            'types': [place_query],
            'source': 'openstreetmap',
        })

    return places


def normalize_place(place):
    display_name = place.get('displayName', {}) or {}
    location = place.get('location', {}) or {}
    place_id = place.get('id') or place.get('name', '').replace('places/', '')
    maps_uri = place.get('googleMapsUri') or build_maps_url(display_name.get('text', ''), place.get('formattedAddress', ''))

    return {
        'id': place_id,
        'name': display_name.get('text', '') or place.get('name', ''),
        'rating': place.get('rating'),
        'address': place.get('formattedAddress', ''),
        'location': {
            'lat': location.get('latitude'),
            'lng': location.get('longitude'),
        },
        'maps_url': maps_uri,
        'googleMapsUri': maps_uri,
        'map': maps_uri,
        'price_level': place.get('priceLevel'),
        'primary_type': place.get('primaryType'),
        'types': place.get('types', []),
    }


def fetch_route_osrm(start, destination):
    start_coords = place_coordinates_from_text(start)
    destination_coords = place_coordinates_from_text(destination)
    if not start_coords or not destination_coords:
        return None

    osrm_url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{start_coords['lng']},{start_coords['lat']};{destination_coords['lng']},{destination_coords['lat']}"
    )
    params = {
        'overview': 'full',
        'geometries': 'geojson',
    }

    response = requests.get(osrm_url, params=params, timeout=20)
    response.raise_for_status()
    payload = response.json()
    routes = payload.get('routes', [])
    if not routes:
        return None

    route = routes[0]
    duration_seconds = int(route.get('duration', 0))
    distance_meters = int(route.get('distance', 0))
    duration_hours = round(duration_seconds / 3600, 1) if duration_seconds else 0
    distance_km = round(distance_meters / 1000, 1) if distance_meters else 0

    coordinates = route.get('geometry', {}).get('coordinates', [])
    polyline_points = [[coord[1], coord[0]] for coord in coordinates if len(coord) >= 2]

    return {
        'distance': f'{distance_km} km',
        'duration': f'{duration_hours} hours',
        'distance_meters': distance_meters,
        'duration_seconds': duration_seconds,
        'polyline': '',
        'polyline_points': polyline_points,
        'steps': [],
        'source': 'osrm',
    }


def fetch_route(start, destination):
    url = 'https://routes.googleapis.com/directions/v2:computeRoutes'
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration',
    }
    body = {
        'origin': {'address': start},
        'destination': {'address': destination},
        'travelMode': 'DRIVE',
        'routingPreference': 'TRAFFIC_AWARE',
        'polylineQuality': 'OVERVIEW',
        'polylineEncoding': 'ENCODED_POLYLINE',
        'languageCode': 'en-US',
        'units': 'METRIC',
    }
    response = requests.post(url, headers=headers, json=body, timeout=20)
    if response.status_code == 403:
        osrm_route = fetch_route_osrm(start, destination)
        if osrm_route:
            osrm_route['error'] = 'Google Routes API blocked, using OSRM route fallback.'
            return osrm_route
        return {
            'distance': None,
            'duration': None,
            'distance_meters': None,
            'duration_seconds': None,
            'polyline': '',
            'polyline_points': [],
            'steps': [],
            'error': 'Routes API is not enabled or the API key is not authorized for Routes API.',
        }

    response.raise_for_status()
    payload = response.json()

    if not payload.get('routes'):
        raise ValueError(payload.get('error', {}).get('message') or 'Unable to fetch route')

    route = payload['routes'][0]
    leg = (route.get('legs') or [{}])[0]
    return {
        'distance': f"{round(route.get('distanceMeters', 0) / 1000, 1)} km" if route.get('distanceMeters') is not None else 'N/A',
        'duration': route.get('duration', 'N/A'),
        'distance_meters': route.get('distanceMeters'),
        'duration_seconds': route.get('duration'),
        'polyline': route.get('polyline', {}).get('encodedPolyline', ''),
        'polyline_points': [],
        'steps': [step.get('navigationInstruction', {}).get('instructions', '') for step in leg.get('steps', []) if step.get('navigationInstruction')],
        'source': 'google',
    }


def fetch_places(location, place_query, limit=5):
    url = 'https://places.googleapis.com/v1/places:searchText'
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.name,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri,places.priceLevel,places.primaryType,places.types',
    }
    body = {
        'textQuery': f'{place_query} in {location}',
        'pageSize': min(max(int(limit), 1), 20),
    }

    try:
        response = requests.post(url, headers=headers, json=body, timeout=20)
        if response.status_code == 403:
            return fetch_places_overpass(location, place_query, limit=limit)
        if response.status_code == 429:
            return fetch_places_overpass(location, place_query, limit=limit)

        response.raise_for_status()
        payload = response.json()
        return [normalize_place(place) for place in payload.get('places', [])[:limit]]
    except requests.RequestException:
        try:
            return fetch_places_overpass(location, place_query, limit=limit)
        except Exception:
            return []


def build_itinerary(days, destination, hotels, restaurants, attractions, stay_budget, food_budget, activity_budget):
    itinerary = []
    day_count = max(days, 1)
    stay_per_day = round(stay_budget / day_count, 2) if day_count else 0
    food_per_day = round(food_budget / day_count, 2) if day_count else 0
    activity_per_day = round(activity_budget / day_count, 2) if day_count else 0

    for index in range(day_count):
        hotel = hotels[index % len(hotels)] if hotels else None
        restaurant = restaurants[index % len(restaurants)] if restaurants else None
        visit = attractions[index % len(attractions)] if attractions else None

        hotel_cost = round(stay_per_day, 2)
        restaurant_cost = round(food_per_day, 2)
        visit_cost = round(activity_per_day, 2)
        hotel_name = hotel.get('name') if hotel else destination
        restaurant_name = restaurant.get('name') if restaurant else destination
        visit_name = visit.get('name') if visit else destination

        itinerary.append({
            'day': f'Day {index + 1}',
            'hotel': hotel,
            'restaurant': restaurant,
            'visit': visit,
            'estimated_cost': {
                'hotel': hotel_cost,
                'restaurant': restaurant_cost,
                'visit': visit_cost,
                'total': round(hotel_cost + restaurant_cost + visit_cost, 2),
            },
            'note': f'Plan the day around {visit_name} and stay at {hotel_name}, then eat at {restaurant_name}.',
        })

    return itinerary


def build_arrival_plan(destination, hotels, restaurants, attractions):
    primary_hotel = hotels[0] if hotels else None
    backup_hotel = hotels[1] if len(hotels) > 1 else None

    return {
        'destination': destination,
        'arrival_message': f'You have reached {destination}. Freshen up at a nearby stay, eat, and start sightseeing.',
        'stay_primary': primary_hotel,
        'stay_backup': backup_hotel,
        'nearby_food': restaurants[:3],
        'best_places_to_visit': attractions[:5],
    }


def build_transport_options(distance_km):
    safe_distance_km = max(float(distance_km or 0), 0)

    modes = {
        'train': {'cost_per_km': 1.2, 'speed_kmph': 65},
        'bus': {'cost_per_km': 1.0, 'speed_kmph': 45},
        'car': {'cost_per_km': 7.5, 'speed_kmph': 55},
        'motorcycle': {'cost_per_km': 2.5, 'speed_kmph': 50},
        'bike': {'cost_per_km': 0.1, 'speed_kmph': 15},
        'walk': {'cost_per_km': 0.0, 'speed_kmph': 5},
    }

    options = []
    for mode, meta in modes.items():
        estimated_cost = round(safe_distance_km * meta['cost_per_km'], 2)
        estimated_hours = round(safe_distance_km / meta['speed_kmph'], 1) if meta['speed_kmph'] > 0 else None
        options.append({
            'mode': mode,
            'distance_km': round(safe_distance_km, 1),
            'estimated_cost': estimated_cost,
            'estimated_duration_hours': estimated_hours,
        })

    airplane_cost = round(1800 + (safe_distance_km * 4.2), 2)
    airplane_hours = round(max(safe_distance_km / 600, 0.6) + 1.3, 1)
    options.append({
        'mode': 'airplane',
        'distance_km': round(safe_distance_km, 1),
        'estimated_cost': airplane_cost,
        'estimated_duration_hours': airplane_hours,
    })

    return options


def build_travel_costs(distance_km):
    km = max(float(distance_km or 0), 0)
    return {
        'train': int(km * 1.5),
        'bus': int(km * 1.2),
        'car': int(km * 5.0),
        'motorcycle': int(km * 2.0),
        'bike': int(km * 0.8),
        'airplane': int(1800 + (km * 4.2)),
        'walk': f"{int(km / 4)} hours",
    }

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400

    password_hash = hash_password(password)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO users (email, password_hash, status) VALUES (?, ?, ?)',
                       (email, password_hash, 'pending'))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'User already exists'}), 409

    conn.close()
    send_admin_email(email)

    return jsonify({'message': 'Signup request sent. Wait for admin approval.'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Missing credentials'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, email, password_hash, status FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()

    if not row or not check_password(password, row['password_hash']):
        return jsonify({'error': 'Invalid email or password'}), 401

    status = row['status']
    if status == 'pending':
        return jsonify({'error': 'Your account is under review. Please wait for admin approval.'}), 403
    elif status == 'rejected':
        return jsonify({'error': 'Your signup request was rejected.'}), 403

    user = {
        'id': row['id'],
        'email': row['email']
    }

    return jsonify({'message': 'Login successful', 'user': user}), 200

@app.route('/get-pending-users', methods=['GET'])
def get_pending_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, email FROM users WHERE status = ?', ('pending',))
    rows = cursor.fetchall()
    conn.close()

    users = [{'id': row['id'], 'email': row['email']} for row in rows]
    return jsonify({'users': users}), 200

@app.route('/approve-user', methods=['GET', 'POST'])
def approve_user():
    if request.method == 'GET':
        email = request.args.get('email')
    else:
        data = request.json
        email = data.get('email')

    if not email:
        return jsonify({'error': 'Email required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET status = ? WHERE email = ?', ('approved', email))
    if cursor.rowcount == 0:
        conn.close()
        if request.method == 'GET':
            return "Error: User not found", 404
        return jsonify({'error': 'User not found'}), 404
    conn.commit()
    conn.close()

    if request.method == 'GET':
        return f"User {email} has been approved!"
    return jsonify({'message': 'User approved'}), 200

@app.route('/reject-user', methods=['GET', 'POST'])
def reject_user():
    if request.method == 'GET':
        email = request.args.get('email')
    else:
        data = request.json
        email = data.get('email')

    if not email:
        return jsonify({'error': 'Email required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET status = ? WHERE email = ?', ('rejected', email))
    if cursor.rowcount == 0:
        conn.close()
        if request.method == 'GET':
            return "Error: User not found", 404
        return jsonify({'error': 'User not found'}), 404
    conn.commit()
    conn.close()

    if request.method == 'GET':
        return f"User {email} has been rejected!"
    return jsonify({'message': 'User rejected'}), 200

@app.route('/approve', methods=['GET'])
def approve_via_link():
    email = request.args.get('email')
    if not email:
        return "Error: Email required", 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET status = ? WHERE email = ?', ('approved', email))
    if cursor.rowcount == 0:
        conn.close()
        return "Error: User not found", 404
    conn.commit()
    conn.close()

    return f"User {email} has been approved!" 

@app.route('/reject', methods=['GET'])
def reject_via_link():
    email = request.args.get('email')
    if not email:
        return "Error: Email required", 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET status = ? WHERE email = ?', ('rejected', email))
    if cursor.rowcount == 0:
        conn.close()
        return "Error: User not found", 404
    conn.commit()
    conn.close()

    return f"User {email} has been rejected!"

@app.route('/plan-trip', methods=['POST'])
def plan_trip():
    data = request.get_json(silent=True) or {}
    start = (data.get('start') or '').strip()
    destination = (data.get('destination') or '').strip()
    budget = float(data.get('budget') or 0)
    days = int(data.get('days') or 1)
    user_type = data.get('user_type') or 'solo'
    people_count = max(int(data.get('people_count') or 1), 1)

    if not start or not destination:
        return jsonify({'error': 'Missing start or destination'}), 400
    if budget <= 0 or days <= 0:
        return jsonify({'error': 'Budget and days must be greater than zero'}), 400

    try:
        route = fetch_route(start, destination)
        hotels = fetch_places(destination, 'hotel', limit=5)
        restaurants = fetch_places(destination, 'restaurant', limit=5)
        police = fetch_places(destination, 'police station', limit=5)
        hospitals = fetch_places(destination, 'hospital', limit=5)
        attractions = fetch_places(destination, 'tourist attraction', limit=5)
    except Exception as ex:
        return jsonify({'error': f'Failed to fetch live travel data: {str(ex)}'}), 502

    origin_coords = place_coordinates_from_text(start)
    destination_coords = place_coordinates_from_text(destination)

    if not route.get('distance') or not route.get('duration'):
        if origin_coords and destination_coords:
            approx_distance_km = round(
                haversine_km(
                    origin_coords['lat'],
                    origin_coords['lng'],
                    destination_coords['lat'],
                    destination_coords['lng'],
                ) * 1.25,
                1,
            )
            approx_hours = round(approx_distance_km / 45, 1)
            route['distance'] = f'{approx_distance_km} km (estimated)'
            route['duration'] = f'{approx_hours} hours (estimated)'
            route['distance_meters'] = int(approx_distance_km * 1000)
            route['duration_seconds'] = int(approx_hours * 3600)
            route['fallback_used'] = True
        else:
            route['distance'] = 'Unavailable'
            route['duration'] = 'Unavailable'
            route['fallback_used'] = True

    distance_km = 0
    if route.get('distance_meters'):
        distance_km = route['distance_meters'] / 1000
    elif isinstance(route.get('distance'), str):
        parts = route['distance'].split(' ')
        try:
            distance_km = float(parts[0])
        except (ValueError, IndexError):
            distance_km = 0

    travel_budget = round(budget * 0.4, 2)
    stay_budget = round(budget * 0.3, 2)
    food_budget = round(budget * 0.2, 2)
    other_budget = round(budget * 0.1, 2)

    per_person_cost = round(budget / people_count, 2) if people_count else None
    safety_mode = user_type == 'female_solo'

    itinerary = build_itinerary(days, destination, hotels, restaurants, attractions, stay_budget, food_budget, other_budget)
    arrival_plan = build_arrival_plan(destination, hotels, restaurants, attractions)
    transport_options = build_transport_options(distance_km)
    travel_costs = build_travel_costs(distance_km)

    return jsonify({
        'route': route,
        'distance': route['distance'],
        'duration': route['duration'],
        'route_error': route.get('error'),
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'origin_coords': origin_coords,
        'destination_coords': destination_coords,
        'budget_breakdown': {
            'travel': travel_budget,
            'stay': stay_budget,
            'food': food_budget,
            'other': other_budget,
            'total': round(budget, 2),
        },
        'per_person_cost': per_person_cost,
        'remaining_budget': round(budget - (travel_budget + stay_budget + food_budget + other_budget), 2),
        'safety_mode': safety_mode,
        'safe_route_badge': safety_mode,
        'hotels': hotels,
        'restaurants': restaurants,
        'food': restaurants,
        'food_places': restaurants,
        'tourist_places': attractions,
        'police': police,
        'hospitals': hospitals,
        'attractions': attractions,
        'itinerary': itinerary,
        'arrival_plan': arrival_plan,
        'transport_options': transport_options,
        'travel_costs': travel_costs,
        'emergency': {
            'police': '100',
            'ambulance': '108',
            'women_helpline': '1091',
        },
        'travel_type': user_type,
    }), 200

@app.route('/', methods=['GET'])
def index():
    return jsonify({'message': 'Trip planner API is running'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
