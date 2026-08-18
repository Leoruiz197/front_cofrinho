import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) return <pre>Falha ao renderizar o front:{'\n'}{this.state.error.stack}</pre>
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>,
)
