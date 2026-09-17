'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { PegasusHeader, usePegasusTheme } from '../pegasus-header'
import type { ChatConversation, ChatMessage, SendChatResult } from '../../lib/chat/types'
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '../../lib/chat/attachment-limits'
import { composerHeight, isNearConversationEnd } from '../../lib/chat/viewport'
import { BrowserTextToSpeech, BrowserVoiceCapture, ServerSpeechToText, mapMicrophoneError } from '../../lib/voice/browser'
import type { VoiceState } from '../../lib/voice/types'
import { DigitalPresence, type DigitalPresenceState } from './digital-presence'

type Props = {
  displayName: string
  conversations: ChatConversation[]
  activeConversation: ChatConversation | null
  initialMessages: ChatMessage[]
  initialDraft?: string
  initialVoiceIntent?: boolean
  voiceSurface?: boolean
  homeSurface?: boolean
  homeContext?: {
    importantNow: Array<{ id: string; title: string; detail: string; label: string }>
    tasks: Array<{ id: string; title: string; detail: string; label: string }>
    memories: Array<{ id: string; content: string; provenance: string }>
    taskError: boolean
    memoryError: boolean
  }
}

type RequestError = { error?: { code?: string; message?: string } }

export function ChatShell({ displayName, conversations: initialConversations, activeConversation: initialConversation, initialMessages, initialDraft = '', initialVoiceIntent = false, voiceSurface = false, homeSurface = false, homeContext }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [conversation, setConversation] = useState(initialConversation)
  const [messages, setMessages] = useState(initialMessages)
  const [content, setContent] = useState(initialDraft)
  const [retryContent, setRetryContent] = useState('')
  const [status, setStatus] = useState<'ready' | 'processing' | 'error' | 'cancelled'>('ready')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceMessage, setVoiceMessage] = useState('')
  const [memoryNotice, setMemoryNotice] = useState('')
  const { theme, toggleTheme } = usePegasusTheme()
  const [online, setOnline] = useState(true)
  const [booting, setBooting] = useState(homeSurface)
  const controller = useRef<AbortController | null>(null)
  const voiceController = useRef<AbortController | null>(null)
  const voiceCapture = useRef<BrowserVoiceCapture | null>(null)
  const finishingVoice = useRef(false)
  const voiceOutput = useRef<BrowserTextToSpeech | null>(null)
  const messageRegionRef = useRef<HTMLDivElement | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const shouldFollowMessages = useRef(true)
  const voiceIntentStarted = useRef(false)
  const startVoiceFromIntent = useRef<() => void>(() => undefined)

  useEffect(() => {
    const region = messageRegionRef.current
    if (region && shouldFollowMessages.current) {
      region.scrollTo({ top: region.scrollHeight, behavior: status === 'processing' ? 'smooth' : 'auto' })
    }
  }, [messages, status])
  useEffect(() => {
    const input = composerInputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${composerHeight(input.scrollHeight)}px`
    input.style.overflowY = input.scrollHeight > 160 ? 'auto' : 'hidden'
  }, [content])
  useEffect(() => () => {
    voiceController.current?.abort()
    voiceCapture.current?.cancel()
    voiceOutput.current?.cancel()
  }, [])
  useEffect(() => {
    if (!initialVoiceIntent || voiceIntentStarted.current) return
    voiceIntentStarted.current = true
    startVoiceFromIntent.current()
  }, [initialVoiceIntent])
  useEffect(() => {
    if (!homeSurface) return
    const updateConnection = () => setOnline(navigator.onLine)
    const initializationFrame = window.requestAnimationFrame(updateConnection)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bootTimer = window.setTimeout(() => setBooting(false), reduceMotion ? 0 : 1_800)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.cancelAnimationFrame(initializationFrame); window.clearTimeout(bootTimer)
      window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection)
    }
  }, [homeSurface])

  function newConversation() {
    controller.current?.abort()
    cancelVoice(false)
    shouldFollowMessages.current = true
    setConversation(null); setMessages([]); setContent(''); setFiles([]); setError(''); setMemoryNotice(''); setStatus('ready'); setSidebarOpen(false)
    window.history.replaceState({}, '', voiceSurface ? '/app/voice' : homeSurface ? '/app' : '/app/chat')
  }

  async function sendMessage(value: string, speakResponse = false) {
    const outgoing = value.trim()
    if (!outgoing || status === 'processing') return
    const selectedFiles = files
    shouldFollowMessages.current = true
    const optimistic: ChatMessage = { id: `pending-${crypto.randomUUID()}`, conversationId: conversation?.id ?? 'pending', role: 'user', content: outgoing, createdAt: new Date().toISOString(), attachments: selectedFiles.map((file, index) => ({ id: `pending-${index}`, name: file.name, mediaType: file.type, size: file.size, classification: 'internal' })) }
    setMessages((current) => [...current, optimistic]); setContent(''); setRetryContent(outgoing); setError(''); setStatus('processing')
    const abortController = new AbortController(); controller.current = abortController
    try {
      const body = new FormData(); body.set('content', outgoing); body.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); if (conversation?.id) body.set('conversationId', conversation.id); selectedFiles.forEach((file) => body.append('attachments', file))
      const response = await fetch('/api/chat', { method: 'POST', body, signal: abortController.signal })
      const payload = await response.json() as SendChatResult & RequestError
      if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível concluir a mensagem.')
      setConversation(payload.conversation)
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), payload.userMessage, payload.assistantMessage])
      setConversations((current) => [payload.conversation, ...current.filter((item) => item.id !== payload.conversation.id)])
      window.history.replaceState({}, '', `${voiceSurface ? '/app/voice' : homeSurface ? '/app' : '/app/chat'}?conversation=${payload.conversation.id}`)
      setFiles([]); setRetryContent(''); setStatus('ready')
      setMemoryNotice(payload.memory.action === 'persist'
        ? 'Memória guardada. Você pode revisar ou corrigir esse item na área Memória.'
        : payload.memory.reason === 'sensitive'
          ? 'Essa informação não foi guardada porque pode conter dado sensível ou credencial.'
          : payload.memory.reason === 'curation_failed'
            ? 'Não foi possível guardar essa informação agora. A conversa continuou normalmente.'
            : '')
      if (speakResponse) speakAssistant(payload.assistantMessage.content)
      else if (voiceState === 'processing') setVoiceState('idle')
    } catch (caught) {
      if (abortController.signal.aborted) { setStatus('cancelled'); setError('A geração foi cancelada. Sua mensagem continua visível nesta tela.') }
      else { setStatus('error'); setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a mensagem.') }
      if (speakResponse) setVoiceState(abortController.signal.aborted ? 'cancelled' : 'error')
    } finally { controller.current = null }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(content) }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }
  function cancel() { controller.current?.abort() }

  function trackMessageScroll() {
    const region = messageRegionRef.current
    if (!region) return
    shouldFollowMessages.current = isNearConversationEnd(region)
  }

  function speakAssistant(text: string) {
    const output = voiceOutput.current ?? new BrowserTextToSpeech()
    voiceOutput.current = output
    if (!output.isAvailable()) { setVoiceState('idle'); setVoiceMessage('Resposta criada. A leitura em voz não está disponível neste navegador.'); return }
    setVoiceState('speaking'); setVoiceMessage('Pegasus está respondendo em voz. Toque no microfone para interromper.')
    output.speak(text, {
      onEnd: () => { if (voiceSurface || homeSurface) void startVoice(); else { setVoiceState('idle'); setVoiceMessage('') } },
      onError: () => { setVoiceState('error'); setVoiceMessage('A resposta foi criada, mas não pôde ser reproduzida em voz.') },
    })
  }

  async function startVoice() {
    if (status === 'processing' || voiceState === 'processing' || voiceState === 'requesting_permission') return
    voiceOutput.current?.cancel()
    setVoiceState('requesting_permission'); setVoiceMessage('Aguardando permissão do microfone...'); setError('')
    const capture = new BrowserVoiceCapture()
    voiceCapture.current = capture
    try {
      await capture.start(() => { void finishVoice() })
      setVoiceState('listening'); setVoiceMessage('Estou ouvindo. Ao terminar de falar, aguarde um instante ou toque para concluir.')
    } catch (caught) {
      const safe = mapMicrophoneError(caught)
      setVoiceState('error'); setVoiceMessage(safe.message)
      voiceCapture.current = null
    }
  }
  startVoiceFromIntent.current = () => { void startVoice() }

  async function finishVoice() {
    const capture = voiceCapture.current
    if (!capture || finishingVoice.current) return
    finishingVoice.current = true
    setVoiceState('processing'); setVoiceMessage('Preparando sua mensagem de voz...')
    const abortController = new AbortController()
    voiceController.current = abortController
    try {
      const audio = await capture.stop()
      voiceCapture.current = null
      const transcript = await new ServerSpeechToText().transcribe(audio, abortController.signal)
      setContent(transcript.text)
      setVoiceMessage(`Entendi: “${transcript.text}” Enviando ao Pegasus...`)
      await sendMessage(transcript.text, true)
    } catch (caught) {
      if (abortController.signal.aborted) { setVoiceState('cancelled'); setVoiceMessage('Interação por voz cancelada.') }
      else { const safe = mapMicrophoneError(caught); setVoiceState('error'); setVoiceMessage(safe.message) }
    } finally { voiceController.current = null; finishingVoice.current = false }
  }

  function cancelVoice(showMessage = true) {
    voiceController.current?.abort()
    voiceCapture.current?.cancel()
    voiceOutput.current?.cancel()
    voiceCapture.current = null
    finishingVoice.current = false
    setVoiceState(showMessage ? 'cancelled' : 'idle')
    setVoiceMessage(showMessage ? 'Interação por voz cancelada.' : '')
  }

  function toggleVoice() {
    if (voiceState === 'listening') void finishVoice()
    else void startVoice()
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? [])
    if (next.length > MAX_ATTACHMENTS) { setError(`Selecione no máximo ${MAX_ATTACHMENTS} arquivos.`); event.target.value = ''; return }
    const invalid = next.find((file) => !ALLOWED_ATTACHMENT_TYPES.includes(file.type as typeof ALLOWED_ATTACHMENT_TYPES[number]) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES)
    if (invalid) { setError('Use imagens, PDF, TXT ou Markdown de até 10 MB.'); event.target.value = ''; return }
    setFiles(next); setError(''); event.target.value = ''
  }

  if (homeSurface) {
    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    const visualState: DigitalPresenceState = !online ? 'offline' : status === 'processing' ? 'processing' : status === 'error' ? 'error' : 'ready'
    const stateLabel = booting ? 'Inicializando presença' : visualState === 'processing' ? 'Processando' : visualState === 'offline' ? 'Sem conexão' : visualState === 'error' ? 'Atenção necessária' : 'Pronto'
    const context = homeContext ?? { importantNow: [], tasks: [], memories: [], taskError: false, memoryError: false }
    return (
      <main className={`digital-home theme-${theme} state-${visualState} ${booting ? 'is-booting' : ''}`}>
        <PegasusHeader current="pegasus" theme={theme} onToggleTheme={toggleTheme} conversationId={conversation?.id} />

        <section className="digital-home-layout" aria-label="Presença e contexto do Pegasus">
          <aside className="context-column context-left">
            <article className="context-card"><header><span>O que importa agora</span><small>Contexto real</small></header>{context.taskError ? <p className="context-empty error">Não foi possível consultar o contexto agora.</p> : context.importantNow.length ? <ul>{context.importantNow.map((item) => <li key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small></div><span>{item.label}</span></li>)}</ul> : <p className="context-empty">Nenhum item prioritário registrado.</p>}</article>
            <article className="context-card memory-context"><header><span>Memória recente</span><Link href="/memory">Ver memória</Link></header>{context.memoryError ? <p className="context-empty error">Não foi possível consultar a memória agora.</p> : context.memories.length ? <ul>{context.memories.slice(0, 2).map((memory) => <li key={memory.id}><div><strong>{memory.content}</strong><small>{memory.provenance}</small></div></li>)}</ul> : <p className="context-empty">Ainda não há memória relevante registrada.</p>}</article>
          </aside>

          <section className="presence-stage" aria-live="polite">
            <p className="presence-eyebrow">PRESENÇA DIGITAL</p>
            <DigitalPresence state={visualState} label={stateLabel} />
            <h1>Olá, {displayName}.</h1>
            <p className="presence-status"><i aria-hidden="true" />{stateLabel}</p>
            <p className="presence-message">{voiceMessage || (visualState === 'ready' ? 'Estou disponível. Fale ou escreva o que você precisa.' : visualState === 'offline' ? 'A conexão foi interrompida. Suas informações continuam protegidas.' : 'Acompanhando sua solicitação.')}</p>
            <Link className="presence-voice-button" href={conversation?.id ? `/app/voice?conversation=${conversation.id}` : '/app/voice'}>Falar com Pegasus</Link>
          </section>

          <aside className="context-column context-right">
            <article className="context-card"><header><span>Pendências</span><small>Tasks reais</small></header>{context.taskError ? <p className="context-empty error">Não foi possível consultar as pendências agora.</p> : context.tasks.length ? <ul>{context.tasks.slice(0, 4).map((task) => <li key={task.id}><div><strong>{task.title}</strong><small>{task.detail}</small></div><span>{task.label}</span></li>)}</ul> : <p className="context-empty">Nenhuma task aberta foi registrada.</p>}</article>
            <article className="context-card connection-card"><header><span>Estado do Pegasus</span><small>{online ? 'Online' : 'Offline'}</small></header><p className="context-empty">{online ? 'Conexão disponível para conversar.' : 'Aguardando a conexão ser restabelecida.'}</p></article>
          </aside>
        </section>

        <section className="universal-interaction" aria-label="Interação com Pegasus">
          {latestAssistant ? <div className="latest-response"><span>Pegasus</span><p>{latestAssistant.content}</p><Link href={`/app/chat?conversation=${conversation?.id ?? latestAssistant.conversationId}`}>Abrir histórico</Link></div> : null}
          {error ? <p className="home-interaction-error" role="alert">{error}</p> : null}
          <form action="/app/chat" method="get">{conversation?.id ? <input type="hidden" name="conversation" value={conversation.id} /> : null}<label className="sr-only" htmlFor="home-command">Pergunte ou peça alguma coisa ao Pegasus</label><input id="home-command" name="message" defaultValue="" placeholder="Pergunte ou peça alguma coisa ao Pegasus..." maxLength={4000} disabled={!online} /><Link className="home-mic-button" href={conversation?.id ? `/app/voice?conversation=${conversation.id}` : '/app/voice'} aria-label="Abrir conversa por voz">●</Link><button type="submit" disabled={!online}>Abrir conversa</button></form>
        </section>
      </main>
    )
  }

  if (voiceSurface) {
    const stateLabel = voiceState === 'listening' ? 'Estou ouvindo' : voiceState === 'processing' ? 'Processando sua mensagem' : voiceState === 'speaking' ? 'Pegasus está falando' : voiceState === 'requesting_permission' ? 'Preparando o microfone' : voiceState === 'error' ? 'Não foi possível usar a voz' : 'Pronto para conversar'
    const visualState: DigitalPresenceState = voiceState === 'listening' ? 'listening' : voiceState === 'processing' || voiceState === 'requesting_permission' ? 'processing' : voiceState === 'speaking' ? 'speaking' : voiceState === 'error' ? 'error' : 'ready'
    return <main className={`voice-surface theme-${theme}`} aria-live="polite"><header><a href={conversation?.id ? `/app?conversation=${conversation.id}` : '/app'} onClick={() => cancelVoice(false)}>← Voltar</a><strong>Pegasus</strong><button type="button" onClick={() => cancelVoice()}>Encerrar</button></header><section className="voice-stage"><DigitalPresence state={visualState} compact label={stateLabel} /><p className="eyebrow">CONVERSA POR VOZ</p><h1>{stateLabel}</h1><p>{voiceMessage || 'Quando estiver pronto, inicie a conversa por voz.'}</p><div className="voice-surface-controls"><button className="voice-main-control" type="button" onClick={toggleVoice} aria-label={voiceState === 'listening' ? 'Concluir gravação' : 'Começar conversa'}>{voiceState === 'listening' ? 'Concluir' : 'Começar conversa'}</button>{voiceState === 'speaking' ? <button className="secondary-button" type="button" onClick={() => cancelVoice()}>Interromper</button> : null}</div></section></main>
  }

  return (
    <main className={`chat-app-shell theme-${theme}`}><PegasusHeader current="history" theme={theme} onToggleTheme={toggleTheme} conversationId={conversation?.id} /><section className="chat-app">
      <aside className={`chat-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Conversas recentes">
        <div className="chat-brand"><span className="brand-symbol" aria-hidden="true">P</span><div><strong>Pegasus</strong><small>Consult Services</small></div></div>
        <button className="new-chat-button" type="button" onClick={newConversation}><span aria-hidden="true">＋</span>Nova conversa</button>
        <nav className="conversation-list" aria-label="Histórico recente">
          <p className="navigation-label">CONVERSAS RECENTES</p>
          {conversations.length === 0 ? <p className="sidebar-empty">Suas conversas aparecerão aqui.</p> : conversations.map((item) => <a className={item.id === conversation?.id ? 'conversation-link active' : 'conversation-link'} href={`/app/chat?conversation=${item.id}`} key={item.id}>{item.title || 'Conversa sem título'}</a>)}
        </nav>
        <nav className="sidebar-footer" aria-label="Conta"><a href={conversation?.id ? `/app?conversation=${conversation.id}` : '/app'}><span aria-hidden="true">◇</span>Início</a><a href="/memory"><span aria-hidden="true">◫</span>Memória</a><a href="/security/mfa"><span aria-hidden="true">○</span>Segurança</a><a href="/sessions"><span aria-hidden="true">▣</span>Sessões</a></nav>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Fechar conversas" onClick={() => setSidebarOpen(false)} />}

      <section className="chat-main">
        <header className="chat-header">
          <button className="menu-button" type="button" aria-label="Abrir conversas" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button>
          <div><strong>{conversation?.title || 'Nova conversa'}</strong><span className="mode-badge"><i />Ambiente de validação</span></div>
          <form action="/auth/logout" method="post"><button className="link-button compact" type="submit">Sair</button></form>
        </header>

        <div className="conversation-workspace">
          <div className="message-region" ref={messageRegionRef} onScroll={trackMessageScroll} aria-live="polite" aria-busy={status === 'processing'}>
            {messages.length === 0 ? <section className="chat-welcome"><span className="welcome-mark">P</span><p className="eyebrow">PEGASUS</p><h1>Olá, {displayName.toLocaleUpperCase('pt-BR')}.</h1><p>Como posso ajudar agora?</p><small>Este ambiente usa respostas locais de teste e não gera custo de IA.</small></section> : <div className="message-list">{messages.map((message) => <article className={`chat-message ${message.role}`} key={message.id}><span>{message.role === 'user' ? 'Você' : 'Pegasus'}</span>{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((item) => <span key={item.id}>▧ {item.name}</span>)}</div> : null}<p>{message.content}</p></article>)}{memoryNotice ? <div className="chat-notice memory" role="status"><span>{memoryNotice}</span><a href="/memory">Revisar memória</a></div> : null}{status === 'processing' && <div className="processing-state" role="status"><i /><span>Pegasus está preparando a resposta...</span></div>}{error && <div className={status === 'cancelled' ? 'chat-notice warning' : 'chat-notice error'} role="alert"><span>{error}</span>{status === 'error' && retryContent && <button type="button" onClick={() => void sendMessage(retryContent)}>Tentar novamente</button>}</div>}</div>}
          </div>

          <div className="composer-wrap">
            <form className="chat-composer" onSubmit={submit}>
             <label className="future-action attachment-action" aria-label="Anexar arquivos" title="Adicionar imagem ou documento">＋<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown,.md" onChange={selectFiles} disabled={status === 'processing'} /></label>
            <label className="sr-only" htmlFor="message">Mensagem para o Pegasus</label>
            <textarea ref={composerInputRef} id="message" value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={keyDown} placeholder="Converse com o Pegasus" rows={1} maxLength={12000} disabled={status === 'processing'} />
            <button className={`future-action voice-action ${voiceState === 'listening' ? 'is-listening' : ''} ${voiceState === 'speaking' ? 'is-speaking' : ''}`} type="button" onClick={toggleVoice} disabled={status === 'processing' || voiceState === 'processing' || voiceState === 'requesting_permission'} aria-label={voiceState === 'listening' ? 'Concluir gravação de voz' : voiceState === 'speaking' ? 'Interromper resposta e falar' : 'Iniciar mensagem de voz'} aria-pressed={voiceState === 'listening'} title={voiceState === 'listening' ? 'Concluir gravação' : 'Falar com o Pegasus'}>{voiceState === 'listening' ? '■' : '●'}</button>
            {status === 'processing' ? <button className="cancel-button" type="button" onClick={cancel}>Cancelar</button> : <button className="send-button" type="submit" disabled={!content.trim()} aria-label="Enviar mensagem">Enviar</button>}
            </form>
            {files.length ? <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${file.size}`}>▧ {file.name}<button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}
            {voiceMessage ? <div className={`voice-feedback ${voiceState}`} role="status"><span>{voiceMessage}</span>{voiceState === 'listening' || voiceState === 'speaking' ? <button type="button" onClick={() => cancelVoice()}>Cancelar</button> : null}</div> : null}
            <p className="composer-hint">Enter envia, Shift + Enter cria uma nova linha.</p>
          </div>
        </div>
      </section>
    </section></main>
  )
}
