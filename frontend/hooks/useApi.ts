import { useState, useEffect } from 'react'
import api, { endpoints } from '@/utils/api'

interface UseApiOptions {
  immediate?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(
  endpoint: string,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { immediate = true, onSuccess, onError } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.get(endpoint)
      setData(response.data)
      onSuccess?.(response.data)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred'
      setError(errorMessage)
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (immediate) {
      fetchData()
    }
  }, [endpoint, immediate])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

// Hook for POST requests
export function useApiPost<T, R>(
  endpoint: string,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const postData = async (data: T): Promise<R | null> => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.post(endpoint, data)
      onSuccess?.(response.data)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred'
      setError(errorMessage)
      onError?.(err)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    postData,
    loading,
    error,
  }
}

// Hook for PUT requests
export function useApiPut<T, R>(
  endpoint: string,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const putData = async (data: T): Promise<R | null> => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.put(endpoint, data)
      onSuccess?.(response.data)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred'
      setError(errorMessage)
      onError?.(err)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    putData,
    loading,
    error,
  }
}

// Hook for DELETE requests
export function useApiDelete(
  endpoint: string,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteData = async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    
    try {
      await api.delete(endpoint)
      onSuccess?.(null)
      return true
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred'
      setError(errorMessage)
      onError?.(err)
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    deleteData,
    loading,
    error,
  }
}
