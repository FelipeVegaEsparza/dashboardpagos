# 🔍 Informe de Revisión Técnica - Sistema de Pagos

**Fecha:** 2 de Abril, 2026  
**Estado:** Producción en Dokploy  
**Severidad:** 🔴 CRÍTICO | 🟠 ALTO | 🟡 MEDIO | 🟢 BAJO

---

## 📋 Resumen Ejecutivo

Se identificaron **23 problemas técnicos** en el sistema desplegado en producción:
- 🔴 **5 Críticos** - Requieren atención inmediata
- 🟠 **8 Altos** - Afectan seguridad y estabilidad
- 🟡 **7 Medios** - Mejoras recomendadas
- 🟢 **3 Bajos** - Optimizaciones opcionales

---

## 🔴 PROBLEMAS CRÍTICOS (Acción Inmediata)

### 1. **Archivo .env Commiteado al Repositorio**
**Severidad:** 🔴 CRÍTICO  
**Ubicación:** `.env`  
**Problema:** El archivo `.env` contiene credenciales en texto plano y está versionado en Git.

**Evidencia:**
```bash
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_PASSWORD=password
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Impacto:**
- Exposición de credenciales de base de datos
- JWT secret comprometido
- Cualquiera con acceso al repositorio puede acceder al sistema

**Solución:**
```bash
# 1. Eliminar del repositorio
git rm --cached .env
git commit -m "Remove .env from repository"
git push

# 2. Agregar al .gitignore (ya está, pero verificar)
echo ".env" >> .gitignore

# 3. Cambiar TODAS las credenciales en producción
# 4. Rotar JWT_SECRET inmediatamente
```

---

### 2. **Credenciales Débiles por Defecto**
**Severidad:** 🔴 CRÍTICO  
**Ubicación:** `.env`, `database/schema.sql`  
**Problema:** Contraseñas predecibles en uso.

**Credenciales expuestas:**
- Usuario admin: `admin` / `admin123`
- MySQL root: `rootpassword`
- MySQL user: `password`
- JWT Secret: `your-super-secret-jwt-key-change-this-in-production`

**Solución:**
```bash
# Generar credenciales seguras
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -base64 24  # Para passwords

# Actualizar en Dokploy:
# 1. Variables de entorno
# 2. Cambiar password de admin en BD
# 3. Reiniciar servicios
```

---

### 3. **Falta Directorio de Uploads en .gitignore**
**Severidad:** 🔴 CRÍTICO  
**Ubicación:** `.gitignore`  
**Problema:** Los archivos subidos por usuarios están siendo versionados en Git.

**Evidencia:**
```
public/uploads/services/*.png  # 15 archivos commiteados
```

**Impacto:**
- Repositorio crece innecesariamente
- Archivos de clientes expuestos en el repositorio
- Problemas de sincronización entre entornos

**Solución:**
```bash
# Agregar a .gitignore
echo "public/uploads/" >> .gitignore
echo "!public/uploads/.gitkeep" >> .gitignore

# Crear .gitkeep para mantener estructura
mkdir -p public/uploads/{services,receipts,branding}
touch public/uploads/{services,receipts,branding}/.gitkeep

# Eliminar archivos del repositorio
git rm -r --cached public/uploads/services/*.png
git commit -m "Remove uploaded files from repository"
```

---

### 4. **Token Blacklist en Archivo de Texto**
**Severidad:** 🔴 CRÍTICO  
**Ubicación:** `public/api/jwt.php`, `public/api/token_blacklist.txt`  
**Problema:** Sistema de blacklist de tokens usa archivo de texto plano sin persistencia adecuada.

**Problemas:**
- No funciona en entornos multi-instancia (Dokploy puede tener múltiples contenedores)
- Pérdida de datos al reiniciar contenedor
- Sin sincronización entre instancias
- Archivo accesible públicamente si no está protegido

**Solución:**
```php
// Migrar a base de datos
CREATE TABLE token_blacklist (
    jti VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expires (expires_at)
);

// Limpiar tokens expirados con cron job
DELETE FROM token_blacklist WHERE expires_at < NOW();
```

---

### 5. **Rate Limiting en Sistema de Archivos**
**Severidad:** 🔴 CRÍTICO  
**Ubicación:** `public/api/auth.php` (clase `RateLimiter`)  
**Problema:** Rate limiting usa archivos JSON, no funciona en entornos distribuidos.

**Problemas:**
- No funciona con múltiples instancias de API
- Pérdida de datos al reiniciar
- Fácil de bypassear
- Directorio `rate_limits/` puede no ser writable en producción

**Solución:**
```php
// Opción 1: Usar Redis (recomendado)
$redis = new Redis();
$redis->connect('redis', 6379);
$key = "rate_limit:$identifier";
$attempts = $redis->incr($key);
if ($attempts === 1) {
    $redis->expire($key, 3600);
}

// Opción 2: Usar base de datos
CREATE TABLE rate_limits (
    identifier VARCHAR(255) PRIMARY KEY,
    attempts INT DEFAULT 0,
    first_attempt TIMESTAMP,
    locked_until TIMESTAMP NULL,
    INDEX idx_locked (locked_until)
);
```

---

## 🟠 PROBLEMAS ALTOS (Seguridad y Estabilidad)

### 6. **Falta Validación de Tamaño de Archivos en Nginx**
**Severidad:** 🟠 ALTO  
**Ubicación:** `nginx.conf`  
**Problema:** No hay límite configurado para el tamaño de uploads.

**Solución:**
```nginx
# Agregar en nginx.conf
client_max_body_size 10M;  # Ajustar según necesidad
```

---

### 7. **CORS Permite Requests sin Origin**
**Severidad:** 🟠 ALTO  
**Ubicación:** `public/api/config.php`  
**Problema:** El código permite requests sin header `Origin`, lo que puede ser explotado.

**Código problemático:**
```php
if (empty($origin)) {
    // Same-origin request - no CORS headers needed
}
```

**Solución:**
```php
// En producción, siempre requerir Origin
if (empty($origin) && getenv('ENVIRONMENT') === 'production') {
    http_response_code(403);
    echo json_encode(['error' => 'Origin header required']);
    exit;
}
```

---

### 8. **Falta Protección CSRF**
**Severidad:** 🟠 ALTO  
**Ubicación:** Todos los endpoints POST/PUT/DELETE  
**Problema:** No hay tokens CSRF para proteger contra ataques Cross-Site Request Forgery.

**Solución:**
```php
// Implementar CSRF tokens
class CSRF {
    public static function generateToken(): string {
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
        return $token;
    }
    
    public static function validateToken(string $token): bool {
        return isset($_SESSION['csrf_token']) && 
               hash_equals($_SESSION['csrf_token'], $token);
    }
}
```

---

### 9. **Falta Validación de Content-Type**
**Severidad:** 🟠 ALTO  
**Ubicación:** Múltiples endpoints  
**Problema:** No se valida que el Content-Type sea JSON antes de parsear.

**Solución:**
```php
// Agregar al inicio de cada endpoint
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'application/json') === false && 
        strpos($contentType, 'multipart/form-data') === false) {
        ApiResponse::error('Invalid Content-Type', 415);
        exit;
    }
}
```

---

### 10. **Falta Logging de Seguridad**
**Severidad:** 🟠 ALTO  
**Ubicación:** Sistema completo  
**Problema:** No hay logs de eventos de seguridad (intentos de login fallidos, accesos no autorizados, etc.).

**Solución:**
```php
// Crear sistema de audit log
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);
```

---

### 11. **Falta Backup Automático de Base de Datos**
**Severidad:** 🟠 ALTO  
**Ubicación:** `docker-compose.prod.yml`  
**Problema:** No hay estrategia de backup configurada.

**Solución:**
```yaml
# Agregar servicio de backup
backup:
  image: databack/mysql-backup
  environment:
    DB_SERVER: db
    DB_USER: ${MYSQL_USER}
    DB_PASS: ${MYSQL_PASSWORD}
    DB_NAMES: ${MYSQL_DATABASE}
    DB_DUMP_FREQ: 1440  # Cada 24 horas
    DB_DUMP_TARGET: /backups
  volumes:
    - ./backups:/backups
  depends_on:
    - db
```

---

### 12. **Falta Health Checks en Servicios**
**Severidad:** 🟠 ALTO  
**Ubicación:** `docker-compose.prod.yml`  
**Problema:** Solo la BD tiene healthcheck, API y frontend no.

**Solución:**
```yaml
api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/api/health.php"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

frontend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

### 13. **Falta Límite de Conexiones a Base de Datos**
**Severidad:** 🟠 ALTO  
**Ubicación:** `public/api/config.php`  
**Problema:** No hay pool de conexiones ni límites configurados.

**Solución:**
```php
// Agregar opciones de PDO
$options = [
    // ... opciones existentes ...
    PDO::ATTR_PERSISTENT => false,  // Evitar conexiones persistentes
    PDO::ATTR_TIMEOUT => 5,         // Timeout de conexión
];

// En MySQL
SET GLOBAL max_connections = 200;
SET GLOBAL max_user_connections = 50;
```

---

## 🟡 PROBLEMAS MEDIOS (Mejoras Recomendadas)

### 14. **Falta Compresión de Respuestas JSON**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `nginx.conf`  
**Problema:** Gzip está configurado pero no incluye `application/json`.

**Solución:**
```nginx
gzip_types text/plain text/css text/xml text/javascript 
           application/javascript application/xml+rss 
           application/json;  # ← Agregar
```

---

### 15. **Falta Índices en Tablas Críticas**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `database/schema.sql`  
**Problema:** Faltan índices compuestos para queries comunes.

**Solución:**
```sql
-- Índices compuestos para mejorar performance
ALTER TABLE subscriptions 
ADD INDEX idx_client_status (client_id, status);

ALTER TABLE subscriptions 
ADD INDEX idx_status_next_payment (status, next_payment_date);

ALTER TABLE payments 
ADD INDEX idx_subscription_date (subscription_id, date);
```

---

### 16. **Falta Paginación en Algunos Endpoints**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `public/api/services.php`, `public/api/products.php`  
**Problema:** No todos los endpoints tienen paginación.

**Solución:**
```php
// Implementar paginación en todos los GET que retornan listas
$pagination = Pagination::getParams();
// ... aplicar LIMIT y OFFSET
```

---

### 17. **Falta Validación de Email en Clientes**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `public/api/clients.php`  
**Problema:** No se valida formato de email al crear/actualizar clientes.

**Solución:**
```php
if (!empty($data['email'])) {
    $validator->email('email');
}
```

---

### 18. **Falta Soft Delete en Clientes**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `database/schema.sql`, `public/api/clients.php`  
**Problema:** Los clientes se eliminan permanentemente, perdiendo historial.

**Solución:**
```sql
ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE clients ADD INDEX idx_deleted (deleted_at);

-- En queries, agregar: WHERE deleted_at IS NULL
```

---

### 19. **Falta Caché de Queries Frecuentes**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `public/api/dashboard.php`, `public/api/services.php`  
**Problema:** Queries repetitivas sin caché.

**Solución:**
```php
// Usar Redis o APCu para cachear
$cacheKey = "dashboard:stats:" . date('Y-m-d');
$stats = $redis->get($cacheKey);
if (!$stats) {
    $stats = calculateStats();
    $redis->setex($cacheKey, 3600, json_encode($stats));
}
```

---

### 20. **Falta Validación de Fechas Lógicas**
**Severidad:** 🟡 MEDIO  
**Ubicación:** `public/api/subscriptions.php`, `public/api/payments.php`  
**Problema:** No se valida que las fechas sean lógicas (ej: fecha de pago no puede ser futura).

**Solución:**
```php
// Validar que fecha de pago no sea futura
if (strtotime($date) > time()) {
    ApiResponse::error('Payment date cannot be in the future', 400);
    return;
}
```

---

## 🟢 PROBLEMAS BAJOS (Optimizaciones)

### 21. **Falta Documentación de API (OpenAPI/Swagger)**
**Severidad:** 🟢 BAJO  
**Problema:** No hay documentación formal de la API.

**Solución:**
Crear archivo `openapi.yaml` con especificación completa.

---

### 22. **Falta Monitoreo y Métricas**
**Severidad:** 🟢 BAJO  
**Problema:** No hay sistema de monitoreo (Prometheus, Grafana, etc.).

**Solución:**
```yaml
# Agregar a docker-compose.prod.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

---

### 23. **Falta Tests Automatizados**
**Severidad:** 🟢 BAJO  
**Problema:** No hay tests unitarios ni de integración.

**Solución:**
Implementar PHPUnit para backend y Jest para frontend.

---

## 📊 Priorización de Acciones

### Inmediato (Hoy)
1. ✅ Eliminar `.env` del repositorio
2. ✅ Cambiar todas las credenciales en producción
3. ✅ Rotar JWT_SECRET
4. ✅ Agregar `public/uploads/` a `.gitignore`

### Esta Semana
5. ✅ Migrar token blacklist a base de datos
6. ✅ Migrar rate limiting a Redis o BD
7. ✅ Implementar backup automático
8. ✅ Agregar health checks
9. ✅ Configurar logging de seguridad

### Este Mes
10. ✅ Implementar protección CSRF
11. ✅ Agregar validaciones faltantes
12. ✅ Optimizar índices de BD
13. ✅ Implementar caché
14. ✅ Configurar monitoreo

---

## 🛠️ Scripts de Remediación

### Script 1: Limpieza de Repositorio
```bash
#!/bin/bash
# cleanup_repo.sh

# Eliminar .env del historial
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Eliminar uploads del historial
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch -r public/uploads/services" \
  --prune-empty --tag-name-filter cat -- --all

# Forzar push
git push origin --force --all
```

### Script 2: Migración de Seguridad
```sql
-- security_migration.sql

-- Token blacklist
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expires (expires_at)
);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    identifier VARCHAR(255) PRIMARY KEY,
    attempts INT DEFAULT 0,
    first_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_locked (locked_until),
    INDEX idx_updated (updated_at)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Soft delete para clientes
ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE clients ADD INDEX idx_deleted (deleted_at);

-- Índices adicionales
ALTER TABLE subscriptions ADD INDEX idx_client_status (client_id, status);
ALTER TABLE subscriptions ADD INDEX idx_status_next_payment (status, next_payment_date);
ALTER TABLE payments ADD INDEX idx_subscription_date (subscription_id, date);
```

---

## 📝 Checklist de Verificación Post-Remediación

```markdown
### Seguridad
- [ ] .env eliminado del repositorio
- [ ] Credenciales rotadas en producción
- [ ] JWT_SECRET cambiado
- [ ] Token blacklist en BD
- [ ] Rate limiting en Redis/BD
- [ ] CSRF tokens implementados
- [ ] Audit logging activo

### Infraestructura
- [ ] Backups automáticos configurados
- [ ] Health checks en todos los servicios
- [ ] Límites de recursos configurados
- [ ] Monitoreo activo

### Código
- [ ] Validaciones completas
- [ ] Índices optimizados
- [ ] Caché implementado
- [ ] Logs estructurados

### Documentación
- [ ] API documentada
- [ ] Runbook de incidentes
- [ ] Procedimientos de backup/restore
```

---

## 🎯 Conclusión

El sistema tiene una base sólida pero requiere atención inmediata en aspectos de seguridad críticos, especialmente:

1. **Gestión de secretos** - Credenciales expuestas
2. **Persistencia de seguridad** - Rate limiting y blacklist en archivos
3. **Backup y recuperación** - Sin estrategia definida

**Tiempo estimado de remediación:**
- Críticos: 4-6 horas
- Altos: 2-3 días
- Medios: 1 semana
- Bajos: 2 semanas

**Recomendación:** Priorizar los 5 problemas críticos antes de continuar con nuevas funcionalidades.
