import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardNavbar } from '@/components/DashboardNavbar'
import React from 'react'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <SidebarProvider>
            <div className='flex w-full h-screen overflow-hidden bg-slate-50'>
                <AppSidebar />
                <div className="flex flex-col flex-1 w-full h-full relative overflow-hidden">
                    <DashboardNavbar />
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    )
}

export default layout