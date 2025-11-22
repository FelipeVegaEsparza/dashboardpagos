import React from 'react';

const Button = ({ children, onClick, variant = 'primary', type = 'button', title, className }) => {
    const getVariantStyle = () => {
        switch (variant) {
            case 'secondary':
                return {
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-main)',
                };
            case 'danger':
                return {
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                };
            default:
                return {
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                    border: 'none',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                };
        }
    };

    const baseStyle = {
        padding: '0.75rem 1.5rem',
        borderRadius: '12px',
        fontSize: '0.95rem',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        outline: 'none',
        ...getVariantStyle(),
    };

    return (
        <button
            type={type}
            onClick={onClick}
            style={baseStyle}
            title={title}
            className={className}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                if (variant === 'primary') {
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (variant === 'primary') {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                }
            }}
        >
            {children}
        </button>
    );
};

export default Button;
