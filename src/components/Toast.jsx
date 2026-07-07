import { useState, useCallback, useEffect, useRef } from 'react'

export function useToast() {
  const [msg, setMsg] = useState('')
  const [show, setShow] = useState(false)
  const timerRef = useRef(null)

  const toast = useCallback((message) => {
    clearTimeout(timerRef.current)
    setMsg(message)
    setShow(true)
    timerRef.current = setTimeout(() => setShow(false), 2500)
  }, [])

  return { msg, show, toast }
}

export function Toast({ msg, show }) {
  return <div className={`toast${show ? ' show' : ''}`}>{msg}</div>
}
