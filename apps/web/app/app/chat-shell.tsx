'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import type { ChatConversation, ChatMessage, SendChatResult } from '../../lib/chat/types'
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '../../lib/chat/attachment-limits'

type Props = {
  displayName: string
  conversations: ChatConversation[]
  activeConversation: ChatConversation | null
  initialMessages: ChatMessage[]
}

type RequestError = { error?: { code?: string; message?: string } }

export function ChatShell({ displayName, conversations: initialConversations, activeConversation: initialConversation, initialMessages }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [conversation, setConversation] = useState(initialConversation)
  const [messages, setMessages] = useState(initialMessages)
  const [content, setContent] = useState('')
  const [retryContent, setRetryContent] = useState('')
  const [status, setStatus] = useState<'ready' | 'processing' | 'error' | 'cancelled'>('ready')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const controller = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, status])

  function newConversation() {
    controller.current?.abort()
    setConversation(null); setMessages([]); setContent(''); setFiles([]); setError(''); setStatus('ready'); setSidebarOpen(false)
    window.history.replaceState({}, '', '/app')
  }

  async function sendMessage(value: string) {
    const outgoing = value.trim()
    if (!outgoing || status === 'processing') return
    const selectedFiles = files
    const optimistic: ChatMessage = { id: `pending-${crypto.randomUUID()}`, conversationId: conversation?.id ?? 'pending', role: 'user', content: outgoing, createdAt: new Date().toISOString(), attachments: selectedFiles.map((file, index) => ({ id: `pending-${index}`, name: file.name, mediaType: file.type, size: file.size, classification: 'internal' })) }
    setMessages((current) => [...current, optimistic]); setContent(''); setRetryContent(outgoing); setError(''); setStatus('processing')
    const abortController = new AbortController(); controller.current = abortController
    try {
      const body = new FormData(); body.set('content', outgoing); if (conversation?.id) body.set('conversationId', conversation.id); selectedFiles.forEach((file) => body.append('attachments', file))
      const response = await fetch('/api/chat', { method: 'POST', body, signal: abortController.signal })
      const payload = await response.json() as SendChatResult & RequestError
      if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível concluir a mensagem.')
      setConversation(payload.conversation)
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), payload.userMessage, payload.assistantMessage])
      setConversations((current) => [payload.conversation, ...current.filter((item) => item.id !== payload.conversation.id)])
      window.history.replaceState({}, '', `/app?conversation=${payload.conversation.id}`)
      setFiles([]); setRetryContent(''); setStatus('ready')
    } catch (caught) {
      if (abortController.signal.aborted) { setStatus('cancelled'); setError('A geração foi cancelada. Sua mensagem continua visível nesta tela.') }
      else { setStatus('error'); setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a mensagem.') }
    } finally { controller.current = null }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(content) }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }
  function cancel() { controller.current?.abort() }
  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? [])
    if (next.length > MAX_ATTACHMENTS) { setError(`Selecione no máximo ${MAX_ATTACHMENTS} arquivos.`); event.target.value = ''; return }
    const invalid = next.find((file) => !ALLOWED_ATTACHMENT_TYPES.includes(file.type as typeof ALLOWED_ATTACHMENT_TYPES[number]) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES)
    if (invalid) { setError('Use imagens, PDF, TXT ou Markdown de até 10 MB.'); event.target.value = ''; return }
    setFiles(next); setError(''); event.target.value = ''
  }

  return (
    <main className="chat-app">
      <aside className={`chat-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Conversas recentes">
        <div className="chat-brand"><span className="brand-symbol" aria-hidden="true">P</span><div><strong>Pegasus</strong><small>Consult Services</small></div></div>
        <button className="new-chat-button" type="button" onClick={newConversation}><span aria-hidden="true">＋</span>Nova conversa</button>
        <nav className="conversation-list" aria-label="Histórico recente">
          <p className="navigation-label">CONVERSAS RECENTES</p>
          {conversations.length === 0 ? <p className="sidebar-empty">Suas conversas aparecerão aqui.</p> : conversations.map((item) => <a className={item.id === conversation?.id ? 'conversation-link active' : 'conversation-link'} href={`/app?conversation=${item.id}`} key={item.id}>{item.title || 'Conversa sem título'}</a>)}
        </nav>
        <nav className="sidebar-footer" aria-label="Conta"><a href="/security/mfa"><span aria-hidden="true">○</span>Segurança</a><a href="/sessions"><span aria-hidden="true">▣</span>Sessões</a></nav>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Fechar conversas" onClick={() => setSidebarOpen(false)} />}

      <section className="chat-main">
        <header className="chat-header">
          <button className="menu-button" type="button" aria-label="Abrir conversas" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button>
          <div><strong>{conversation?.title || 'Nova conversa'}</strong><span className="mode-badge"><i />Ambiente de validação</span></div>
          <form action="/auth/logout" method="post"><button className="link-button compact" type="submit">Sair</button></form>
        </header>

        <div className="message-region" aria-live="polite" aria-busy={status === 'processing'}>
          {messages.length === 0 ? <section className="chat-welcome"><span className="welcome-mark">P</span><p className="eyebrow">PEGASUS</p><h1>Olá, {displayName.toLocaleUpperCase('pt-BR')}.</h1><p>Como posso ajudar agora?</p><small>Este ambiente usa respostas locais de teste e não gera custo de IA.</small></section> : <div className="message-list">{messages.map((message) => <article className={`chat-message ${message.role}`} key={message.id}><span>{message.role === 'user' ? 'Você' : 'Pegasus'}</span>{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((item) => <span key={item.id}>▧ {item.name}</span>)}</div> : null}<p>{message.content}</p></article>)}{status === 'processing' && <div className="processing-state" role="status"><i /><span>Pegasus está preparando a resposta...</span></div>}{error && <div className={status === 'cancelled' ? 'chat-notice warning' : 'chat-notice error'} role="alert"><span>{error}</span>{status === 'error' && retryContent && <button type="button" onClick={() => void sendMessage(retryContent)}>Tentar novamente</button>}</div>}<div ref={endRef} /></div>}
        </div>

        <div className="composer-wrap">
          <form className="chat-composer" onSubmit={submit}>
             <label className="future-action attachment-action" aria-label="Anexar arquivos" title="Adicionar imagem ou documento">＋<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown,.md" onChange={selectFiles} disabled={status === 'processing'} /></label>
            <label className="sr-only" htmlFor="message">Mensagem para o Pegasus</label>
            <textarea id="message" value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={keyDown} placeholder="Converse com o Pegasus" rows={1} maxLength={12000} disabled={status === 'processing'} />
             <button className="future-action" type="button" disabled aria-label="Voz disponível em uma próxima etapa" title="Voz, disponível em uma próxima etapa">●</button>
            {status === 'processing' ? <button className="cancel-button" type="button" onClick={cancel}>Cancelar</button> : <button className="send-button" type="submit" disabled={!content.trim()} aria-label="Enviar mensagem">Enviar</button>}
          </form>
          {files.length ? <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${file.size}`}>▧ {file.name}<button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}
          <p className="composer-hint">Enter envia, Shift + Enter cria uma nova linha.</p>
        </div>
      </section>
    </main>
  )
}
