import React, { useEffect, useState } from 'react'
import { api, ApiError } from './api.js'

const TEAM_FALLBACK = Array.from({ length: 50 }, (_, index) => ({
  id: `equipe${String(index + 1).padStart(2, '0')}`,
  name: `Equipe ${String(index + 1).padStart(2, '0')}`,
  color: null,
}))

const safeForTeam = (teamId) => `cofre${String(Number(String(teamId).replace(/\D/g, '')) || 1).padStart(2, '0')}`
const displayError = (error) => error instanceof ApiError && error.status === 409 ? 'Este cofre esta offline.' : error.message || 'Nao foi possivel concluir a operacao.'

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  function navigate(destination) {
    window.history.pushState({}, '', destination)
    setPath(destination)
  }

  const manager = path === '/gestor'
  return <main className={`app ${manager ? 'manager-theme' : 'player-theme'}`}>
    <nav><strong>INFSEC / COFRINHOS</strong><div><button className={!manager ? 'active' : ''} onClick={() => navigate('/')}>Invasao</button><button className={manager ? 'active' : ''} onClick={() => navigate('/gestor')}>Gestor</button></div></nav>
    {manager ? <ManagerGate /> : <PlayerScreen />}
  </main>
}

function PlayerScreen() {
  const [teams, setTeams] = useState(TEAM_FALLBACK)
  const [safes, setSafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [myTeam, setMyTeam] = useState('equipe01')
  const [safeId, setSafeId] = useState('cofre02')
  const [attempt, setAttempt] = useState('')
  const [stage, setStage] = useState(1)
  const [feedback, setFeedback] = useState({ bons: 0, otimos: 0, message: 'Use quatro digitos distintos para cada tentativa.' })
  const stageCount = safes.find((safe) => safe.safeId === safeId)?.stages || 1
  const safeTeams = teams.filter((team) => team.id !== myTeam)
  const target = safeTeams.find((team) => safeForTeam(team.id) === safeId)

  useEffect(() => {
    let active = true
    api('/api/game/catalog')
      .then(({ teams: result, safes: availableSafes }) => {
        if (!active) return
        setTeams(result)
        setSafes(availableSafes)
      })
      .catch(() => { if (active) setFeedback((current) => ({ ...current, message: 'Usando a lista de equipes disponivel. O jogo continua online.' })) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function changeTeam(nextTeam) {
    setMyTeam(nextTeam)
    const nextTarget = teams.find((team) => team.id !== nextTeam)
    setSafeId(safeForTeam(nextTarget?.id || 'equipe02'))
    setStage(1)
    setFeedback({ bons: 0, otimos: 0, message: 'Novo alvo selecionado.' })
  }

  async function sendAttempt() {
    if (!/^\d{4}$/.test(attempt) || new Set(attempt).size !== 4) {
      setFeedback({ bons: 0, otimos: 0, message: 'A senha deve ter quatro digitos distintos.' })
      return
    }
    try {
      const result = await api('/api/game/attempt', { method: 'POST', body: JSON.stringify({ attackerTeamId: myTeam, safeId, stage: `etapa${String(stage).padStart(2, '0')}`, attempt }) })
      if (result.status === 'OK') {
        const complete = stage >= stageCount
        setStage((current) => Math.min(stageCount, current + 1))
        setFeedback({ bons: 0, otimos: 0, message: complete ? 'Cofre invadido. Todas as etapas foram concluidas.' : `Etapa ${stage} concluida. Proxima etapa liberada.` })
      } else setFeedback({ bons: result.bons || 0, otimos: result.otimos || 0, message: 'Senha ainda nao confere. Ajuste sua tentativa.' })
      setAttempt('')
    } catch (error) { setFeedback({ bons: 0, otimos: 0, message: displayError(error) }) }
  }

  return <section className="player-layout" style={{ '--team-color': teams.find((team) => team.id === myTeam)?.color || '#7fffb3' }}>
    <header><div><p className="eyebrow">OPERADOR</p><h1>Painel de Invasao</h1></div><Status value={loading ? 'Carregando' : 'API ativa'} online={!loading} /></header>
    <article className="terminal-card identity-card"><label>Minha equipe<select value={myTeam} onChange={(event) => changeTeam(event.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.id})</option>)}</select></label></article>
    <article className="terminal-card"><p className="eyebrow">ALVO</p><div className="target-row"><label>Cofre de destino<select value={safeId} onChange={(event) => { setSafeId(event.target.value); setStage(1); setFeedback({ bons: 0, otimos: 0, message: 'Novo cofre selecionado.' }) }}>{safeTeams.map((team) => <option key={team.id} value={safeForTeam(team.id)}>{safeForTeam(team.id)} / {team.name}</option>)}</select></label><span className="color-token" style={{ background: target?.color || '#7fffb3' }} /></div><div className="code-row"><input value={attempt} onChange={(event) => setAttempt(event.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(event) => event.key === 'Enter' && sendAttempt()} inputMode="numeric" placeholder="0000" disabled={stage > stageCount} /><button onClick={sendAttempt} disabled={stage > stageCount}>Enviar senha</button></div><div className="score"><span>Bons <b>{feedback.bons}</b></span><span>Otimos <b>{feedback.otimos}</b></span></div><p className="hint">{feedback.message}</p><div className="stage-title"><span>Etapas da invasao</span><b>{Math.min(stage - 1, stageCount)}/{stageCount}</b></div><div className="stages">{Array.from({ length: stageCount }, (_, index) => <i key={index} className={index < stage - 1 ? 'solved' : ''} />)}</div></article>
  </section>
}

function ManagerGate() {
  const [state, setState] = useState('checking')
  const [username, setUsername] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem('cofrinho-token')
    if (!token) { setState('login'); return }
    api('/api/auth/me', { token }).then((manager) => { setUsername(manager.username); setState('ready') }).catch(() => { sessionStorage.removeItem('cofrinho-token'); setState('login') })
  }, [])

  if (state === 'checking') return <section className="login-layout"><p>Validando sessao...</p></section>
  if (state === 'login') return <Login onLogin={(manager) => { setUsername(manager.username); setState('ready') }} />
  return <ManagerScreen username={username} onLogout={() => { sessionStorage.removeItem('cofrinho-token'); setState('login') }} />
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const { token } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      sessionStorage.setItem('cofrinho-token', token)
      const manager = await api('/api/auth/me', { token })
      onLogin(manager)
    } catch (requestError) { sessionStorage.removeItem('cofrinho-token'); setError(displayError(requestError)) }
  }
  return <section className="login-layout"><form className="manager-card login-card" onSubmit={submit}><p className="eyebrow">ACESSO RESTRITO</p><h1>Gestor de Cofres</h1><label>Usuario<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary">Entrar</button></form></section>
}

function ManagerScreen({ username, onLogout }) {
  const [teams, setTeams] = useState([])
  const [safes, setSafes] = useState([])
  const [selectedSafeId, setSelectedSafeId] = useState('')
  const [detail, setDetail] = useState(null)
  const [message, setMessage] = useState('Carregando dados da API...')
  const [config, setConfig] = useState({ ownerTeamId: '', stages: 3, reset: false })

  async function load() {
    try {
      const [teamResponse, safeResponse] = await Promise.all([api('/api/teams'), api('/api/safes')])
      setTeams(teamResponse.teams)
      setSafes(safeResponse.safes)
      const first = selectedSafeId || safeResponse.safes[0]?.id
      if (first) await selectSafe(first, safeResponse.safes)
      setMessage('Dados atualizados agora.')
    } catch (error) { setMessage(displayError(error)) }
  }
  async function selectSafe(safeId, availableSafes = safes) {
    setSelectedSafeId(safeId)
    const fallback = availableSafes.find((safe) => safe.id === safeId)
    try {
      const safe = await api(`/api/safes/${safeId}`)
      setDetail(safe)
      setConfig({ ownerTeamId: safe.ownerTeamId, stages: safe.config.stages, reset: false })
    } catch (error) { setDetail(fallback || null); setMessage(displayError(error)) }
  }
  useEffect(() => { load() }, [])

  async function updateTeam(team, changes) {
    try {
      const updated = await api(`/api/teams/${team.id}`, { method: 'PUT', body: JSON.stringify(changes) })
      setTeams((current) => current.map((item) => item.id === team.id ? updated : item))
      setMessage(`${updated.id} atualizado.`)
    } catch (error) { setMessage(displayError(error)) }
  }
  async function command(command) {
    if (!selectedSafeId) return
    try { await api(`/api/safes/${selectedSafeId}/commands`, { method: 'POST', body: JSON.stringify({ command }) }); setMessage(`Comando "${command}" enviado para ${selectedSafeId}.`); await load() } catch (error) { setMessage(displayError(error)) }
  }
  async function saveConfig() {
    if (!selectedSafeId) return
    try {
      const safe = await api(`/api/safes/${selectedSafeId}/config`, { method: 'PUT', body: JSON.stringify({ ...config, stages: Number(config.stages) }) })
      setDetail(safe); setSafes((current) => current.map((item) => item.id === safe.id ? safe : item)); setConfig((current) => ({ ...current, reset: false })); setMessage(`${safe.id} configurado.`)
    } catch (error) { setMessage(displayError(error)) }
  }

  return <section className="manager-layout"><header><div><p className="eyebrow">ADMINISTRACAO / {username}</p><h1>Gestor de Cofres</h1></div><div className="header-actions"><Status value="Autenticado" online /><button className="quiet-button" onClick={onLogout}>Sair</button></div></header>
    <article className="manager-card toolbar"><p>{message}</p><button onClick={load}>Atualizar</button></article>
    <div className="manager-columns"><article className="manager-card"><div className="section-heading"><div><p className="eyebrow">COFRES</p><h2>Estado dos dispositivos</h2></div><select value={selectedSafeId} onChange={(event) => selectSafe(event.target.value)}>{safes.map((safe) => <option key={safe.id} value={safe.id}>{safe.id} {safe.online ? 'online' : 'offline'}</option>)}</select></div>{detail && <div className="safe-detail"><span className={detail.online ? 'online-dot' : 'offline-dot'} /> <b>{detail.id}</b><span>{detail.online ? 'Online' : 'Offline'}</span><span>Dono: {detail.ownerTeamId}</span><code>{detail.status ? JSON.stringify(detail.status) : 'Sem status do dispositivo'}</code></div>}<div className="command-grid">{['unlock', 'lock', 'light', 'off', 'right_lock', 'left_lock', 'correct'].map((item) => <button key={item} onClick={() => command(item)} disabled={!detail?.online}>{item.replace('_', ' ')}</button>)}</div></article><article className="manager-card"><p className="eyebrow">CONFIGURACAO</p><h2>Enviar ao cofre selecionado</h2><div className="controls"><label>Equipe proprietaria<select value={config.ownerTeamId} onChange={(event) => setConfig((current) => ({ ...current, ownerTeamId: event.target.value }))}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.id})</option>)}</select></label><label>Etapas<input type="number" min="1" max="16" value={config.stages} onChange={(event) => setConfig((current) => ({ ...current, stages: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={config.reset} onChange={(event) => setConfig((current) => ({ ...current, reset: event.target.checked }))} /> Gerar novas senhas</label><button className="primary" onClick={saveConfig} disabled={!detail?.online}>Salvar configuracao</button></div></article></div>
    <article className="manager-card"><p className="eyebrow">EQUIPES</p><div className="team-list">{teams.map((team) => <div className="team-row" key={team.id}><span className="color-token" style={{ background: team.color || '#a8b9cb' }} /><code>{team.id}</code><input defaultValue={team.name} aria-label={`Nome da ${team.id}`} onBlur={(event) => event.target.value !== team.name && updateTeam(team, { name: event.target.value })} /><input type="color" value={team.color || '#a8b9cb'} aria-label={`Cor da ${team.id}`} onChange={(event) => updateTeam(team, { color: event.target.value })} /></div>)}</div></article>
  </section>
}

function Status({ value, online }) { return <span className={`status ${online ? 'online' : ''}`}><i />{value}</span> }
export default App
