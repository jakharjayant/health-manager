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
      await axios.post('${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/register', { name, email, password, role });
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
}\n