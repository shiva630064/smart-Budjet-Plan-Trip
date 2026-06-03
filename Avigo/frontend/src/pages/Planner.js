import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import polyline from '@mapbox/polyline';
import { planTrip } from '../api';

const userTypeOptions = [
  { value: 'solo', label: 'Solo' },
  { value: 'female_solo', label: 'Solo Female' },
  { value: 'group', label: 'Group' },
  { value: 'family', label: 'Family' },
  { value: 'children', label: 'Children' },
  { value: 'temple', label: 'Temple' },
];

const defaultCenter = [20.5937, 78.9629];

const iconFor = (label, color) =>
  L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="width:26px;height:26px;border-radius:999px;background:${color};border:2px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 8px 18px rgba(15,23,42,0.45)">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const icons = {
  hotel: iconFor('H', '#0ea5e9'),
  food: iconFor('F', '#10b981'),
  police: iconFor('P', '#f43f5e'),
  hospital: iconFor('+', '#f97316'),
  tourist: iconFor('T', '#a855f7'),
};

const toLatLng = (item) => {
  const lat = Number(item?.location?.lat);
  const lng = Number(item?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }
  return null;
};

export default function Planner() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ start: '', destination: '', budget: '', days: '', user_type: 'solo', people_count: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('trip-planner-user');
    if (!stored) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('trip-planner-user');
    navigate('/login');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'people_count' ? Number(value) : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShareStatus('');
    try {
      const response = await planTrip({
        ...form,
        budget: Number(form.budget),
        days: Number(form.days),
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not plan trip');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const hotels = Array.isArray(result?.hotels) ? result.hotels : [];
  const restaurants = Array.isArray(result?.food) ? result.food : Array.isArray(result?.restaurants) ? result.restaurants : [];
  const touristPlaces = Array.isArray(result?.tourist_places) ? result.tourist_places : [];
  const policePlaces = Array.isArray(result?.police) ? result.police : [];
  const hospitalPlaces = Array.isArray(result?.hospitals) ? result.hospitals : [];
  const itinerary = Array.isArray(result?.itinerary) ? result.itinerary : [];
  const travelCosts = result?.travel_costs || {};
  const arrivalPlan = result?.arrival_plan || null;

  const mapCenter = useMemo(() => {
    const dest = result?.destination_coords;
    if (dest?.lat && dest?.lng) {
      return [dest.lat, dest.lng];
    }
    const firstHotel = toLatLng(hotels[0]);
    if (firstHotel) {
      return firstHotel;
    }
    return defaultCenter;
  }, [result, hotels]);

  const routeLinePoints = useMemo(() => {
    const directPoints = Array.isArray(result?.route?.polyline_points) ? result.route.polyline_points : [];
    if (directPoints.length > 1) {
      return directPoints;
    }

    const encoded = result?.route?.polyline;
    if (encoded) {
      try {
        return polyline.decode(encoded).map(([lat, lng]) => [lat, lng]);
      } catch {
        return [];
      }
    }

    const origin = result?.origin_coords;
    const dest = result?.destination_coords;
    if (origin?.lat && origin?.lng && dest?.lat && dest?.lng) {
      return [
        [origin.lat, origin.lng],
        [dest.lat, dest.lng],
      ];
    }

    return [];
  }, [result]);

  const safetyMode = form.user_type === 'female_solo';

  const shareLiveLocation = async () => {
    setShareStatus('');
    if (!navigator.geolocation) {
      setShareStatus('Geolocation not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

        try {
          if (navigator.share) {
            await navigator.share({
              title: 'My Live Location',
              text: 'Sharing my current location for safety.',
              url: locationUrl,
            });
            setShareStatus('Location shared successfully.');
          } else {
            await navigator.clipboard.writeText(locationUrl);
            setShareStatus('Location link copied to clipboard.');
          }
        } catch {
          setShareStatus('Could not share location right now.');
        }
      },
      () => setShareStatus('Unable to fetch current location.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const renderPlaceGrid = (title, places, iconType) => (
    <div>
      <p className="font-semibold mb-2">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {places.slice(0, 6).map((place, idx) => (
          <a key={`${place.name || idx}`} href={place.map || place.maps_url} target="_blank" rel="noreferrer" className="data-card block">
            <p className="font-semibold">{place.name || title}</p>
            <p className="text-sm text-slate-400">{place.address || 'Address unavailable'}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{place.rating ? `⭐ ${place.rating}` : 'Live location'}</span>
              <span className="text-cyan-300">Open map</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="surface-card glow-border p-6 lg:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="hero-chip">Trip Input</span>
            <h1 className="page-title mt-3">Plan Your Route</h1>
            <p className="page-subtitle mt-2">Hello {user?.email || 'Traveler'}! Add trip details and generate the dashboard.</p>
          </div>
          <button onClick={handleLogout} className="danger-btn">Logout</button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input name="start" value={form.start} onChange={handleChange} placeholder="Start" className="input-field" required />
          <input name="destination" value={form.destination} onChange={handleChange} placeholder="Destination" className="input-field" required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" name="budget" value={form.budget} onChange={handleChange} placeholder="Budget" className="input-field" required />
            <input type="number" name="days" value={form.days} onChange={handleChange} placeholder="Days" className="input-field" required />
          </div>
          <select name="user_type" value={form.user_type} onChange={handleChange} className="input-field">
            {userTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          {(form.user_type === 'group' || form.user_type === 'family') && (
            <input type="number" name="people_count" value={form.people_count} onChange={handleChange} placeholder="Number of people" className="input-field" min={1} required />
          )}

          {error && <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

          <button type="submit" className="primary-btn w-full" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Trip Dashboard'}
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card">
                <p className="section-caption">Distance</p>
                <p className="text-xl font-bold">{result.route?.distance || result.distance || 'N/A'}</p>
              </div>
              <div className="stat-card">
                <p className="section-caption">Duration</p>
                <p className="text-xl font-bold">{result.route?.duration || result.duration || 'N/A'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card">Travel: ₹{result.budget_breakdown?.travel}</div>
              <div className="stat-card">Stay: ₹{result.budget_breakdown?.stay}</div>
              <div className="stat-card">Food: ₹{result.budget_breakdown?.food}</div>
              <div className="stat-card">Other: ₹{result.budget_breakdown?.other}</div>
            </div>

            <div>
              <h3 className="section-title mb-2">Travel Options</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(travelCosts).map(([mode, cost]) => (
                  <div key={mode} className="data-card">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{mode}</p>
                    <p className="text-sm font-semibold">{typeof cost === 'number' ? `₹${cost}` : cost}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="surface-card glow-border p-6 lg:p-8">
        <div className="mb-4">
          <span className="hero-chip">Result Dashboard</span>
          <h2 className="page-title mt-3">Map + Cards + Safety</h2>
          <p className="page-subtitle mt-2">Route line, place markers, stay/eat/visit cards, and emergency actions.</p>
        </div>

        {!result ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">Fill trip input and generate the dashboard.</div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/75" style={{ height: 360 }}>
              <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

                {routeLinePoints.length > 1 && <Polyline positions={routeLinePoints} pathOptions={{ color: '#22d3ee', weight: 4 }} />}

                {hotels.slice(0, 5).map((hotel, idx) => {
                  const pos = toLatLng(hotel);
                  if (!pos) return null;
                  return (
                    <Marker key={`hotel-${idx}`} position={pos} icon={icons.hotel}>
                      <Popup>{hotel.name || 'Hotel'}</Popup>
                    </Marker>
                  );
                })}

                {restaurants.slice(0, 5).map((item, idx) => {
                  const pos = toLatLng(item);
                  if (!pos) return null;
                  return (
                    <Marker key={`food-${idx}`} position={pos} icon={icons.food}>
                      <Popup>{item.name || 'Food Place'}</Popup>
                    </Marker>
                  );
                })}

                {touristPlaces.slice(0, 5).map((place, idx) => {
                  const pos = toLatLng(place);
                  if (!pos) return null;
                  return (
                    <Marker key={`tourist-${idx}`} position={pos} icon={icons.tourist}>
                      <Popup>{place.name || 'Tourist Place'}</Popup>
                    </Marker>
                  );
                })}

                {policePlaces.slice(0, 4).map((item, idx) => {
                  const pos = toLatLng(item);
                  if (!pos) return null;
                  return (
                    <Marker key={`police-${idx}`} position={pos} icon={icons.police}>
                      <Popup>{item.name || 'Police'}</Popup>
                    </Marker>
                  );
                })}

                {hospitalPlaces.slice(0, 4).map((item, idx) => {
                  const pos = toLatLng(item);
                  if (!pos) return null;
                  return (
                    <Marker key={`hospital-${idx}`} position={pos} icon={icons.hospital}>
                      <Popup>{item.name || 'Hospital'}</Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {renderPlaceGrid('Hotels', hotels, 'hotel')}
            {renderPlaceGrid('Food Places', restaurants, 'food')}
            {renderPlaceGrid('Places to Visit', touristPlaces, 'tourist')}

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="font-semibold text-emerald-200 mb-2">Safety + Emergency</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a href={`tel:${result.emergency?.police || '100'}`} className="secondary-btn">Call Police {result.emergency?.police || '100'}</a>
                <a href={`tel:${result.emergency?.ambulance || '108'}`} className="secondary-btn">Call Ambulance {result.emergency?.ambulance || '108'}</a>
                <button type="button" className="primary-btn" onClick={shareLiveLocation}>Share Location</button>
              </div>
              {shareStatus && <p className="mt-3 text-sm text-emerald-100">{shareStatus}</p>}
              <p className="mt-2 text-sm text-emerald-100">Nearby Police: {policePlaces.length} | Nearby Hospitals: {hospitalPlaces.length}</p>
            </div>

            {arrivalPlan && (
              <div className="space-y-3">
                <p className="font-semibold text-lg">After Reaching Destination</p>
                <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                  {arrivalPlan.arrival_message}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(arrivalPlan.nearby_food || []).slice(0, 2).map((food, idx) => (
                    <a key={`arrival-food-${idx}`} href={food.map || food.maps_url} target="_blank" rel="noreferrer" className="data-card block">
                      <p className="font-semibold">Eat: {food.name}</p>
                      <p className="text-sm text-slate-400">{food.address}</p>
                    </a>
                  ))}
                  {(arrivalPlan.best_places_to_visit || []).slice(0, 2).map((place, idx) => (
                    <a key={`arrival-visit-${idx}`} href={place.map || place.maps_url} target="_blank" rel="noreferrer" className="data-card block">
                      <p className="font-semibold">Visit: {place.name}</p>
                      <p className="text-sm text-slate-400">{place.address}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-semibold mb-2">Day-wise Itinerary</p>
              <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                {itinerary.map((day, idx) => (
                  <div key={`${day.day || idx}`} className="data-card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{day.day}</p>
                      <span className="text-xs text-cyan-300">₹{day.estimated_cost?.total ?? 'N/A'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">Stay: {day.hotel?.name || 'N/A'}</p>
                    <p className="text-sm text-slate-300">Food: {day.restaurant?.name || 'N/A'}</p>
                    <p className="text-sm text-slate-300">Visit: {day.visit?.name || form.destination}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}
