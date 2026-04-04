'use client'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Step 1: Login to get token and basic user info
      const loginRes = await axios.post('http://localhost:8000/auth/login', {
        username,
        password,
      })
      
      const { accessToken, user: basicUser } = loginRes.data

      // Save token 
      localStorage.setItem('accessToken', accessToken)

      // Step 2: Fetch complete user details with all relations
      try {
        const userDetailsRes = await axios.get(`http://localhost:8000/users/${basicUser.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        // This should return the complete user object with all relations
        const completeUser = userDetailsRes.data
        
        // Log the complete user data to verify
        console.log('Complete user data:', completeUser)
        
        // Save complete user info
        localStorage.setItem('user', JSON.stringify(completeUser))

        // ✅ Role-based redirection
        if (completeUser.role === 'SUPERADMIN') {
          router.push('/dashboard')
        } else if (completeUser.role === 'MANAGER') {
          router.push('/dashboard')
        } else {
          router.push('/empdashboard')
        }
      } catch (detailsError) {
        console.error('Error fetching user details:', detailsError)
        // Fallback to basic user if details fetch fails
        localStorage.setItem('user', JSON.stringify(basicUser))
        
        if (basicUser.role === 'SUPERADMIN') {
          router.push('/dashboard')
        } else if (basicUser.role === 'MANAGER') {
          router.push('/dashboard')
        } else {
          router.push('/empdashboard')
        }
      }
      
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="mt-8 w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username */}
          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700"
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-2.5 text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-gray-400"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          © {new Date().getFullYear()} OpenHRMS
        </p>
      </div>
    </div>
  )
}