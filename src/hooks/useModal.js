import { useState, useCallback } from 'react';

/**
 * Hook para manejar modales de alerta y confirmación
 * 
 * Uso:
 * const { modal, showAlert, showConfirm, showSuccess, showError, showDelete, closeModal } = useModal();
 */

export const useModal = () => {
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'alert',
        onConfirm: null,
        confirmText: 'Aceptar',
        cancelText: 'Cancelar',
        confirmVariant: 'primary'
    });

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const showAlert = useCallback((title, message, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'alert',
            onConfirm: options.onConfirm || closeModal,
            confirmText: options.confirmText || 'Aceptar',
            cancelText: 'Cancelar',
            confirmVariant: options.confirmVariant || 'primary'
        });
    }, [closeModal]);

    const showInfo = useCallback((title, message, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'info',
            onConfirm: options.onConfirm || closeModal,
            confirmText: options.confirmText || 'Entendido',
            cancelText: 'Cancelar',
            confirmVariant: options.confirmVariant || 'primary'
        });
    }, [closeModal]);

    const showSuccess = useCallback((title, message, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'success',
            onConfirm: options.onConfirm || closeModal,
            confirmText: options.confirmText || 'Perfecto',
            cancelText: 'Cancelar',
            confirmVariant: options.confirmVariant || 'primary'
        });
    }, [closeModal]);

    const showWarning = useCallback((title, message, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'warning',
            onConfirm: options.onConfirm || closeModal,
            confirmText: options.confirmText || 'Entendido',
            cancelText: 'Cancelar',
            confirmVariant: options.confirmVariant || 'primary'
        });
    }, [closeModal]);

    const showError = useCallback((title, message, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'info',
            onConfirm: options.onConfirm || closeModal,
            confirmText: options.confirmText || 'Entendido',
            cancelText: 'Cancelar',
            confirmVariant: options.confirmVariant || 'danger'
        });
    }, [closeModal]);

    const showConfirm = useCallback((title, message, onConfirm, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'confirm',
            onConfirm,
            confirmText: options.confirmText || 'Confirmar',
            cancelText: options.cancelText || 'Cancelar',
            confirmVariant: options.confirmVariant || 'primary'
        });
    }, []);

    const showDelete = useCallback((title, message, onConfirm, options = {}) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'delete',
            onConfirm,
            confirmText: options.confirmText || 'Eliminar',
            cancelText: options.cancelText || 'Cancelar',
            confirmVariant: 'danger'
        });
    }, []);

    return {
        modal,
        showAlert,
        showInfo,
        showSuccess,
        showError,
        showWarning,
        showConfirm,
        showDelete,
        closeModal
    };
};

export default useModal;
