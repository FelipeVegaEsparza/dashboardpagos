import React from 'react';

const Card = ({ children, title, className, style }) => {
    return (
        <div
            className={`glass ${className || ''}`}
            style={{
                padding: '1.5rem',
                ...style
            }}
        >
            {title && (
                <h3 style={{
                    marginBottom: '1.5rem',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: 'var(--text-main)'
                }}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
};

export default Card;
