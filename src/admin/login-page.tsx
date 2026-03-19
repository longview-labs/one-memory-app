import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './admin-app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const BLACKLIST_API_URL = import.meta.env.VITE_BACKEND_API_URL

export function LoginPage() {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsValidating(true)

    try {
      const res = await fetch(`${BLACKLIST_API_URL}/blacklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ transactionIds: [] }),
      })

      if (res.ok) {
        login(key)
        navigate('/dashboard')
      } else if (res.status === 401) {
        setError('Invalid API key')
      } else {
        setError(`Unexpected error (HTTP ${res.status})`)
      }
    } catch {
      setError('Failed to connect to API')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle className="text-center text-xl">OneMemory Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="API key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={!key || isValidating}>
              {isValidating ? 'Validating...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
