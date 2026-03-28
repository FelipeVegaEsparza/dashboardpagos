import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useModal } from '../hooks/useModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { 
    ArrowLeft, 
    Envelope, 
    EnvelopeOpen, 
    PaperPlaneTilt, 
    Spinner,
    Warning,
    CheckCircle,
    ChatCircleText
} from 'phosphor-react';

const EmailConversations = () => {
    const navigate = useNavigate();
    const { modal, showSuccess, showError, closeModal } = useModal();
    
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [imapAvailable, setImapAvailable] = useState(false);
    
    // Filters
    const [filterUnread, setFilterUnread] = useState(false);
    
    // Reply modal
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [replyBody, setReplyBody] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    useEffect(() => {
        fetchConversations();
    }, [filterUnread]);

    const fetchConversations = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = filterUnread ? '?unread_only=true' : '';
            const response = await api.get(`/conversations.php${params}`);
            setConversations(response.conversations || []);
            setUnreadCount(response.unread_count || 0);
            setImapAvailable(response.imap_available || false);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            setError(error.message || 'Error al cargar conversaciones');
        } finally {
            setLoading(false);
        }
    };

    const fetchNewEmails = async () => {
        if (!imapAvailable) {
            showError('IMAP no disponible', 'La extensión IMAP no está habilitada en el servidor');
            return;
        }
        
        setFetching(true);
        try {
            const response = await api.get('/conversations.php?action=fetch');
            showSuccess('Emails sincronizados', response.message || 'Nuevos emails importados');
            fetchConversations();
        } catch (error) {
            console.error('Error fetching emails:', error);
            showError('Error', 'No se pudieron obtener los emails: ' + (error.message || 'Error desconocido'));
        } finally {
            setFetching(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.post('/conversations.php', { action: 'mark_read', id });
            fetchConversations();
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const openReplyModal = (conv) => {
        setSelectedConversation(conv);
        setReplyBody('');
        setShowReplyModal(true);
    };

    const handleSendReply = async () => {
        if (!replyBody.trim()) {
            showError('Error', 'El mensaje no puede estar vacío');
            return;
        }
        
        setSendingReply(true);
        try {
            await api.post('/conversations.php', {
                action: 'reply',
                conversation_id: selectedConversation.id,
                body: replyBody
            });
            setShowReplyModal(false);
            setSelectedConversation(null);
            setReplyBody('');
            showSuccess('Respuesta enviada', 'Tu respuesta ha sido enviada correctamente');
            fetchConversations();
        } catch (error) {
            console.error('Error sending reply:', error);
            showError('Error', 'No se pudo enviar la respuesta: ' + (error.message || 'Error desconocido'));
        } finally {
            setSendingReply(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Ayer';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('es-ES', { weekday: 'long' });
        } else {
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => navigate('/billing')}
                        title="Volver a Cobranza"
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="m-0">Bandeja de Entrada</h1>
                        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                            {unreadCount > 0 ? `${unreadCount} mensajes sin leer` : 'No hay mensajes nuevos'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => setFilterUnread(!filterUnread)}
                        title={filterUnread ? 'Mostrar todos' : 'Solo no leídos'}
                    >
                        {filterUnread ? 'Mostrar todos' : `No leídos (${unreadCount})`}
                    </Button>
                    <Button 
                        onClick={fetchNewEmails}
                        disabled={fetching}
                        title="Sincronizar con servidor de correo"
                    >
                        {fetching ? (
                            <Spinner size={18} className="spin" />
                        ) : (
                            <Spinner size={18} />
                        )}
                        Sincronizar
                    </Button>
                </div>
            </div>

            {!imapAvailable && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '12px',
                    color: '#eab308'
                }}>
                    <Warning size={24} />
                    <div>
                        <p style={{ margin: 0, fontWeight: 500 }}>IMAP no disponible</p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                            La extensión IMAP de PHP no está instalada. Contacta a tu administrador del servidor.
                        </p>
                    </div>
                </div>
            )}

            {/* Conversations List */}
            {loading ? (
                <p>Cargando...</p>
            ) : error ? (
                <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        ⚠️ Error al cargar conversaciones
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                    <button 
                        onClick={fetchConversations}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {conversations.map((conv) => (
                        <Card 
                            key={conv.id} 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'flex-start',
                                background: conv.is_read ? 'var(--bg-card)' : 'rgba(99, 102, 241, 0.05)',
                                borderLeft: conv.is_read ? 'none' : '4px solid var(--primary)'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {conv.is_outgoing ? (
                                        <PaperPlaneTilt size={18} color="#6366f1" />
                                    ) : conv.is_read ? (
                                        <EnvelopeOpen size={18} color="var(--text-muted)" />
                                    ) : (
                                        <Envelope size={18} color="#6366f1" weight="fill" />
                                    )}
                                    <h3 className="font-semibold m-0" style={{ fontSize: '1rem' }}>
                                        {conv.client_name}
                                    </h3>
                                    {conv.service_name && (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '1rem',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {conv.service_name}
                                        </span>
                                    )}
                                    <span style={{ 
                                        fontSize: '0.75rem', 
                                        color: 'var(--text-muted)',
                                        marginLeft: 'auto'
                                    }}>
                                        {formatDate(conv.created_at)}
                                    </span>
                                </div>
                                
                                <p style={{ 
                                    fontWeight: conv.is_read ? 'normal' : '600',
                                    margin: '0 0 0.5rem 0',
                                    color: 'var(--text-main)'
                                }}>
                                    {conv.subject}
                                </p>
                                
                                <p style={{ 
                                    color: 'var(--text-muted)', 
                                    fontSize: '0.9rem',
                                    margin: 0,
                                    lineHeight: '1.5',
                                    maxHeight: '3em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {conv.body}
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                                {!conv.is_outgoing && !conv.is_read && (
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => markAsRead(conv.id)}
                                        title="Marcar como leído"
                                    >
                                        <EnvelopeOpen size={18} />
                                    </Button>
                                )}
                                <Button 
                                    onClick={() => openReplyModal(conv)}
                                    title="Responder"
                                >
                                    <ChatCircleText size={18} />
                                </Button>
                            </div>
                        </Card>
                    ))}
                    
                    {conversations.length === 0 && (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '4rem 2rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '16px',
                            border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}>
                            <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ color: '#22c55e', marginBottom: '0.5rem' }}>
                                Bandeja limpia
                            </h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                No hay conversaciones de email
                            </p>
                            {imapAvailable && (
                                <Button 
                                    onClick={fetchNewEmails} 
                                    variant="secondary"
                                    style={{ marginTop: '1rem' }}
                                >
                                    <Spinner size={18} />
                                    Sincronizar emails
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Reply Modal */}
            {showReplyModal && selectedConversation && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <Card style={{ width: '100%', maxWidth: '600px' }}>
                        <h3 style={{ marginBottom: '1rem' }}>
                            Responder a {selectedConversation.client_name}
                        </h3>
                        
                        <div style={{ 
                            padding: '1rem', 
                            background: 'rgba(255,255,255,0.05)', 
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <strong>Asunto:</strong> Re: {selectedConversation.subject}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <strong>Para:</strong> {selectedConversation.email_from}
                            </p>
                        </div>

                        <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            rows={8}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'white',
                                resize: 'vertical',
                                fontSize: '0.95rem',
                                lineHeight: '1.6',
                                marginBottom: '1rem'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <Button variant="secondary" onClick={() => setShowReplyModal(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSendReply} disabled={sendingReply}>
                                {sendingReply ? (
                                    <Spinner size={18} className="spin" />
                                ) : (
                                    <PaperPlaneTilt size={18} />
                                )}
                                Enviar Respuesta
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal de notificaciones */}
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                confirmText={modal.confirmText}
                cancelText={modal.cancelText}
                confirmVariant={modal.confirmVariant}
            />

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default EmailConversations;
