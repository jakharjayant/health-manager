import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function PatientDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  
  const { token, logout, user } = useAuth();

  const fetchAppointments = () => {
    axios.get('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/patient/appointments', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAppointments(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    axios.get('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/patient/doctors')
      .then(res => setDoctors(res.data))
      .catch(console.error);
    fetchAppointments();
  }, [token]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // simplified calculation of endTime based on typical 30min slots
      const [h, m] = startTime.split(':').map(Number);
      const endH = m >= 30 ? h + 1 : h;
      const endM = m >= 30 ? m - 30 : m + 30;
      const endTime = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;

      await axios.post('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/patient/book', {
        doctorId: selectedDoctor,
        date,
        startTime,
        endTime,
        symptomsRaw: symptoms
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert('Booked successfully!');
      fetchAppointments();
    } catch(err: any) {
      alert(err.response?.data?.error || 'Booking failed');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patient Dashboard, welcome {user?.name}</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl mb-4 font-bold">Book Appointment</h2>
          <form onSubmit={handleBook} className="flex flex-col gap-4">
            <select className="border p-2" required value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
              <option value="">Select Doctor</option>
              {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.name} - {d.doctorProfile?.specialization}</option>)}
            </select>
            <input type="date" className="border p-2" required value={date} onChange={e => setDate(e.target.value)} />
            <input type="time" className="border p-2" required value={startTime} onChange={e => setStartTime(e.target.value)} />
            <textarea className="border p-2" required placeholder="Describe your symptoms..." value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={3} />
            <button className="bg-blue-600 text-white p-2 rounded">Book Slot</button>
          </form>
        </div>

        <div>
          <h2 className="text-xl mb-4 font-bold">Your Appointments</h2>
          <div className="flex flex-col gap-4">
            {appointments.map((a: any) => (
              <div key={a.id} className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                <p className="font-bold">{a.date} at {a.startTime}</p>
                <p>Status: <span className="uppercase text-sm font-semibold">{a.status}</span></p>
                {a.postVisitSummary && (
                  <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                    <p className="font-bold">Summary:</p>
                    <p>{a.postVisitSummary.patientSummary}</p>
                    <p className="font-bold mt-1">Medication:</p>
                    <p>{a.postVisitSummary.medicationSchedule}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}\n