import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  const handleLogin = async () => {
    const res = await axios.post('http://localhost:3000/auth/login', loginData);
    setToken(res.data.token);
  };

  const registerUnit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    await axios.post('http://localhost:3000/units/create', formData, {
      headers: {
        Authorization: token,
        'Content-Type': 'multipart/form-data'
      }
    });
  };

  return (
    <div>
      <h2>Login</h2>
      <input placeholder="Username" onChange={e => setLoginData({ ...loginData, username: e.target.value })} />
      <input placeholder="Password" type="password" onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
      <button onClick={handleLogin}>Login</button>

      <h2>Register Unit</h2>
      <form onSubmit={registerUnit}>
        <input name="unitId" placeholder="Unit ID" required />
        <input name="unitName" placeholder="Unit Name" required />
        <input name="unitSize" placeholder="Unit Size" required />
        <input name="rentAmount" type="number" placeholder="Rent Amount" required />
        <input name="conditionImages" type="file" multiple />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default App;