import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const { token, logout } = useAuth();

  useEffect(() => {
    axios.get('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/doctors', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDoctors(res.data))
      .catch(console.error);
  }, [token]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>
      <h2 className="text-xl mb-4">Manage Doctors</h2>
      <div className="grid gap-4">
        {doctors.map((d: any) => (
          <div key={d.id} className="bg-white p-4 shadow rounded border">
            <h3 className="font-bold">{d.name} ({d.email})</h3>
            <p>Specialization: {d.doctorProfile?.specialization}</p>
            <p>Working Hours: {d.doctorProfile?.workingHoursStart} - {d.doctorProfile?.workingHoursEnd}</p>
          </div>
        ))}
      </div>
    </div>
  );
}\n