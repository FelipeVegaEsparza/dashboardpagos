# Guía de Seguridad - Payments Dashboard

## Resumen de Medidas Implementadas

### 1. Autenticación JWT
- **Access tokens**: 15 minutos de expiración
- **Refresh tokens**: 7 días con rotación automática
- **Algoritmo**: HS256 (HMAC-SHA256)
- **Blacklist**: Tokens revocados almacenados hasta expiración

### 2. Rate Limiting
- 5 intentos de login fallidos bloquean la IP por 5 minutos
- Almacenado en archivos JSON (cambiar a Redis en producción)

### 3. Subida de Archivos
```php
// Validaciones implementadas:
- MIME type con finfo (no solo extensión)
- Tamaño máximo: 2MB (imágenes), 5MB (recibos)
- Extensiones: jpg, png, gif, webp, pdf
- Nombres aleatorios: bin2hex(random_bytes(16))
- Permisos: directorios 0755, archivos 0644
- .htaccess anti-ejecución en uploads/
```

### 4. Base de Datos
- PDO con prepared statements
- Transacciones ACID para pagos
- Row locking: `SELECT ... FOR UPDATE`
- Índices en claves foráneas

### 5. Headers de Seguridad
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Type: application/json; charset=utf-8
```

### 6. CORS
- Orígenes explícitos configurables
- No se permite `*` en producción
- Headers permitidos: Content-Type, Authorization

---

## Checklist de Despliegue Seguro

### Antes de Producción

- [ ] Cambiar JWT_SECRET (generar con `openssl rand -base64 32`)
- [ ] Cambiar MYSQL_ROOT_PASSWORD y MYSQL_PASSWORD
- [ ] Configurar ALLOWED_ORIGINS con dominio(s) real(es)
- [ ] Cambiar password del usuario admin por defecto
- [ ] Cambiar ENVIRONMENT a `production`
- [ ] Configurar HTTPS (certificados SSL/TLS)
- [ ] Deshabilitar display_errors en PHP
- [ ] Configurar logs centralizados
- [ ] Configurar backups automáticos de BD

### Configuración Recomendada nginx (HTTPS)

```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Resto de configuración...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Auditoría y Monitoreo

### Logs a Monitorear
1. `public/api/error.log` - Errores de PHP
2. `public/api/rate_limits/` - Intentos de login
3. `public/api/debug.log` - Debug de uploads (eliminar en prod)
4. `public/api/token_blacklist.txt` - Tokens revocados

### Alertas Recomendadas
- Múltiples 401/403 desde misma IP
- Uploads de archivos grandes (>10MB)
- Errores de base de datos
- Rate limiting activado frecuentemente

---

## Respuesta a Incidentes

### Token Comprometido
```sql
-- Revocar todos los refresh tokens de un usuario
DELETE FROM refresh_tokens WHERE user_id = ?;
```

### Cuenta Comprometida
1. Desactivar cuenta: `UPDATE users SET is_active = 0 WHERE id = ?`
2. Revocar todos los tokens
3. Forzar cambio de password

### File Upload Malicioso
1. Verificar en `public/uploads/`
2. Eliminar archivo sospechoso
3. Revisar logs de acceso

---

## Penetration Testing Checklist

### Autenticación
- [ ] Fuerza bruta contra login (rate limiting activo)
- [ ] JWT manipulation (algoritmo fijo a HS256)
- [ ] Token expiration (15 min funciona)
- [ ] Refresh token rotation (verificar en BD)

### Autorización
- [ ] Acceso a endpoints sin token (401)
- [ ] Acceso a recursos de otros usuarios
- [ ] Escalación de privilegios (admin vs user)

### Inputs
- [ ] SQL Injection (prepared statements)
- [ ] XSS (output escapado)
- [ ] File upload bypass (MIME + extensión)
- [ ] Path traversal (nombres aleatorios)

### Configuración
- [ ] Headers de seguridad presentes
- [ ] CORS no permite *
- [ ] No expone stack traces en errores
- [ ] HTTPS forzado

---

## Contacto de Seguridad

Para reportar vulnerabilidades:
1. NO crear issue pública
2. Enviar email a: security@tu-empresa.com
3. Incluir pasos de reproducción
4. Tiempo de respuesta: 48 horas
