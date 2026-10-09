import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { RegionsPage } from '@/pages/RegionsPage'
import { RegionDetailPage } from '@/pages/RegionDetailPage'
import { ApartmentsPage } from '@/pages/ApartmentsPage'
import { ApartmentDetailPage } from '@/pages/ApartmentDetailPage'
import { PriceInputPage } from '@/pages/PriceInputPage'
import { BackupPage } from '@/pages/BackupPage'
import { ComparePage } from '@/pages/ComparePage'
import { AreasPage } from '@/pages/AreasPage'
import { AreaDetailPage } from '@/pages/AreaDetailPage'
import { CandidatesPage } from '@/pages/CandidatesPage'
import { MorePage } from '@/pages/MorePage'

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
        <Route path="compare" element={<ComparePage />} />
        <Route path="areas" element={<AreasPage />} />
        <Route path="areas/:areaId" element={<AreaDetailPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
