import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { RegionsPage } from '@/pages/RegionsPage'
import { RegionDetailPage } from '@/pages/RegionDetailPage'
import { ApartmentsPage } from '@/pages/ApartmentsPage'
import { ApartmentDetailPage } from '@/pages/ApartmentDetailPage'
import { PriceInputPage } from '@/pages/PriceInputPage'
import { BackupPage } from '@/pages/BackupPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="regions" element={<RegionsPage />} />
        <Route path="regions/:regionId" element={<RegionDetailPage />} />
        <Route path="apartments" element={<ApartmentsPage />} />
        <Route path="apartments/:apartmentId" element={<ApartmentDetailPage />} />
        <Route path="input" element={<PriceInputPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
