const fs = require('fs');
const path = require('path');

const files = {
  'src/App.tsx': `
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: string }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  if (user?.role !== role) return <div>Unauthorized</div>;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/doctor" element={<ProtectedRoute role="DOCTOR"><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/patient" element={<ProtectedRoute role="PATIENT"><PatientDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
  `,
  'src/context/AuthContext.tsx': `
import { createContext, useContext, useState, ReactNode } from 'react';

type User = { id: string; role: string; name: string };
type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext)!;
}
  `,
  'src/pages/Login.tsx': `
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      login(res.data.token, { id: res.data.id, role: res.data.role, name: res.data.name });
      if (res.data.role === 'ADMIN') navigate('/admin');
      if (res.data.role === 'DOCTOR') navigate('/doctor');
      if (res.data.role === 'PATIENT') navigate('/patient');
    } catch(err) {
      alert('Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
        <h2 className="text-xl mb-4 font-bold">Login</h2>
        <input className="w-full border p-2 mb-4" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full border p-2 mb-4" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="w-full bg-blue-500 text-white p-2 rounded">Login</button>
        <p className="mt-4 text-sm text-center">Don't have an account? <Link to="/register" className="text-blue-500">Register</Link></p>
      </form>
    </div>
  );
}
  `,
  'src/pages/Register.tsx': `
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/auth/register', { name, email, password, role });
      alert('Registered successfully');
      navigate('/login');
    } catch(err) {
      alert('Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
        <h2 className="text-xl mb-4 font-bold">Register</h2>
        <input className="w-full border p-2 mb-2" type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="w-full border p-2 mb-2" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full border p-2 mb-2" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <select className="w-full border p-2 mb-4" value={role} onChange={e => setRole(e.target.value)}>
          <option value="PATIENT">Patient</option>
          <option value="DOCTOR">Doctor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button className="w-full bg-blue-500 text-white p-2 rounded">Register</button>
        <p className="mt-4 text-sm text-center"><Link to="/login" className="text-blue-500">Back to Login</Link></p>
      </form>
    </div>
  );
}
  `,
  'src/pages/AdminDashboard.tsx': `
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const { token, logout } = useAuth();

  useEffect(() => {
    axios.get('http://localhost:5000/api/admin/doctors', { headers: { Authorization: \`Bearer \${token}\` } })
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
}
  `,
  'src/pages/PatientDashboard.tsx': `
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
    axios.get('http://localhost:5000/api/patient/appointments', { headers: { Authorization: \`Bearer \${token}\` } })
      .then(res => setAppointments(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    axios.get('http://localhost:5000/api/patient/doctors')
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
      const endTime = \`\${endH.toString().padStart(2,'0')}:\${endM.toString().padStart(2,'0')}\`;

      await axios.post('http://localhost:5000/api/patient/book', {
        doctorId: selectedDoctor,
        date,
        startTime,
        endTime,
        symptomsRaw: symptoms
      }, { headers: { Authorization: \`Bearer \${token}\` } });
      
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
}
  `,
  'src/pages/DoctorDashboard.tsx': `
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [leaveDate, setLeaveDate] = useState('');
  const { token, logout, user } = useAuth();

  const fetchAppointments = () => {
    axios.get('http://localhost:5000/api/doctor/appointments', { headers: { Authorization: \`Bearer \${token}\` } })
      .then(res => setAppointments(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchAppointments();
  }, [token]);

  const markLeave = async () => {
    if(!leaveDate) return;
    try {
      await axios.post(\`http://localhost:5000/api/admin/doctors/\${user?.id}/leave\`, { date: leaveDate }, { headers: { Authorization: \`Bearer \${token}\` } });
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
      await axios.post(\`http://localhost:5000/api/doctor/appointments/\${apptId}/post-visit\`, {
        clinicalNotesRaw: notes,
        medications: [{ name: "Paracetamol", frequency: "Daily" }] // simplified for demo
      }, { headers: { Authorization: \`Bearer \${token}\` } });
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
  `
};

for (const [filepath, content] of Object.entries(files)) {
  const fullpath = path.join(__dirname, filepath);
  fs.mkdirSync(path.dirname(fullpath), { recursive: true });
  fs.writeFileSync(fullpath, content.trim() + '\\n');
}
console.log('Frontend generated successfully.');
