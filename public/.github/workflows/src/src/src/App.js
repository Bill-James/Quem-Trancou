import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Explorar from './pages/Explorar';
import Ranking from './pages/Ranking';
import Feed from './pages/Feed';
import Perfil from './pages/Perfil';
import TrancistaPerfil from './pages/TrancistaPerfil';
import { Login, Cadastro } from './pages/Auth';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/trancista/:id" element={<TrancistaPerfil />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
