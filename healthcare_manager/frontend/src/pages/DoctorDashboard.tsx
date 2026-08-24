import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [leaveDate, setLeaveDate] = useState('');
  const { token, logout, user } = useAuth();

  const fetchAppointments = () => {
    axios.get('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/doctor/appointments', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAppointments(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchAppointments();
  }, [token]);

  const markLeave = async () => {
    if(!leaveDate) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/doctors/${user?.id}/leave`, { date: leaveDate }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Leave marked, appointments cancelled.');
      fetchAppointments();
    } catch(err) {
      alert('Failed to mark leave');
    }
  };

  const handlePostVisit = async (apptId: string) => {
    const notes = prompt("Enter clinical notes:");
    if (!notes) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/doctor/appointments/${apptId}/post-visit`, {
        clinicalNotesRaw: notes,
        medications: [{ name: "Paracetamol", frequency: "Daily" }] // simplified for demo
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Post-visit summary generated!');
      fetchAppointments();
    } catch (err) {
      alert('Error generating summary');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Doctor Dashboard, {user?.name}</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>

      <div className="bg-white p-4 shadow rounded mb-6 flex gap-4 items-end border">
         <div>
            <label className="block text-sm font-bold mb-1">Mark Leave</label>
            <input type="date" className="border p-2 rounded" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
         </div>
         <button onClick={markLeave} className="bg-yellow-500 text-white px-4 py-2 rounded">Submit Leave</button>
      </div>

      <h2 className="text-xl mb-4 font-bold">Your Appointments</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {appointments.map((a: any) => (
          <div key={a.id} className="bg-white p-4 shadow rounded border">
             <p className="font-bold text-lg">{a.date} | {a.startTime}</p>
             <p>Patient: {a.patient?.name}</p>
             <p>Status: <span className="font-semibold text-blue-600">{a.status}</span></p>
             
             {a.preVisitSummary && (
               <div className="mt-2 bg-red-50 p-2 text-sm rounded">
                 <p className="font-bold text-red-600">Urgency: {a.preVisitSummary.urgencyLevel}</p>
                 <p>Complaint: {a.preVisitSummary.chiefComplaint}</p>
                 <p>Questions to ask: {a.preVisitSummary.questions}</p>
                 <p className="mt-1 text-xs text-gray-500">Raw symptoms: {a.preVisitSummary.symptomsRaw}</p>
               </div>
             )}

             {a.status === 'BOOKED' && (
               <button onClick={() => handlePostVisit(a.id)} className="mt-4 bg-green-500 text-white px-3 py-1 rounded w-full">Complete & Generate Summary</button>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
