import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div className="flex items-center justify-center mb-8">
      <div className="relative">
        <div className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
          KOauth
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
          Authentication that KOs complexity
        </div>
      </div>
    </div>
  )
}
