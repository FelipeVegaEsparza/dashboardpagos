import React from 'react';
import Card from './Card';
import Button from './Button';
import { X, CheckCircle, Warning, Info, Trash } from 'phosphor-react';

/**
 * Modal Component - Sistema de modales personalizados
 * 
 * Tipos:
 * - alert: Muestra un mensaje informativo con botón OK
 * - confirm: Muestra una pregunta con botones Cancelar y Confirmar
 * - delete: Modal específico para confirmar eliminación (estilo danger)
 */

const Modal = ({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    type = 'alert',
    onConfirm,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    confirmVariant = 'primary'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle size={48} color="#22c55e" weight="fill" />;
            case 'warning':
            case 'confirm':
                return <Warning size={48} color="#eab308" weight="fill" />;
            case 'delete':
            case 'danger':
                return <Trash size={48} color="#ef4444" weight="fill" />;
            case 'info':
            default:
                return <Info size={48} color="#6366f1" weight="fill" />;
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                padding: '1rem'
            }}
            onClick={handleOverlayClick}
        >
            <Card style={{ 
                width: '100%', 
                maxWidth: '420px',
                position: 'relative',
                animation: 'modalSlideIn 0.2s ease-out'
            }}>
                {/* Close button for alert/info types */}
                {type === 'alert' || type === 'info' || type === 'success' ? (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'var(--text-main)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                    >
                        <X size={24} />
                    </button>
                ) : null}

                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                    {/* Icon */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        {getIcon()}
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text-main)',
                        marginBottom: '0.75rem'
                    }}>
                        {title}
                    </h3>

                    {/* Message */}
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        marginBottom: '1.5rem',
                        whiteSpace: 'pre-line'
                    }}>
                        {message}
                    </p>

                    {/* Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        justifyContent: 'center'
                    }}>
                        {(type === 'confirm' || type === 'delete' || type === 'danger') && (
                            <Button variant="secondary" onClick={onClose}>
                                {cancelText}
                            </Button>
                        )}
                        <Button 
                            variant={confirmVariant} 
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </Card>

            <style>{`
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
};

export default Modal;
