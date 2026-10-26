import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Appointments } from './client/Appointments'
import { Book } from './client/Book'
import { ClientApp } from './client/ClientApp'
import { Home } from './client/Home'
import { Dashboard } from './dashboard/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route element={<ClientApp />}>
          <Route index element={<Home />} />
          <Route path="book" element={<Book />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
