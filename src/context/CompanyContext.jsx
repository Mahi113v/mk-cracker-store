import { createContext, useContext } from 'react'
const Ctx = createContext({ company: null, refresh: () => {}, has: () => true })
export const CompanyProvider = Ctx.Provider
export const useCompany = () => useContext(Ctx)
