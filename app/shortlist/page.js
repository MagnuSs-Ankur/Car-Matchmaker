'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Shortlist() {
  const router = useRouter();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShortlist = async () => {
      try {
        const res = await fetch('/api/shortlist');
        const data = await res.json();
        if (res.ok && data.cars) {
          setCars(data.cars);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchShortlist();
  }, []);

  const removeCar = async (carId) => {
    try {
      const res = await fetch(`/api/shortlist?carId=${carId}`, { method: 'DELETE' });
      if (res.ok) {
        setCars(prev => prev.filter(c => c._id !== carId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading shortlist...</div>;
  }

  return (
    <main>
      <h1 className="title">My Shortlist</h1>
      
      {cars.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <p className="subtitle">Your shortlist is empty.</p>
          <button onClick={() => router.push('/')} style={{ maxWidth: '200px' }}>Find Cars</button>
        </div>
      ) : (
        <div className="grid">
          {cars.map((car) => (
            <div key={car._id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{car.make} {car.model}</h2>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                  ${car.price.toLocaleString()}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{car.variant}</p>
              
              <div style={{ flexGrow: 1 }}>
                <ul style={{ listStyle: 'none', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <li><strong>Type:</strong> {car.specs.bodyType}</li>
                  <li><strong>Seats:</strong> {car.specs.seating}</li>
                  <li><strong>MPG:</strong> {car.mileage}</li>
                  <li><strong>HP:</strong> {car.specs.horsepower}</li>
                  <li><strong>Safety:</strong> {car.safetyRating}/5</li>
                  <li><strong>Reviews:</strong> {car.userReviews.averageScore}/5</li>
                </ul>
              </div>

              <button 
                onClick={() => removeCar(car._id)} 
                style={{ background: 'var(--error)' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
