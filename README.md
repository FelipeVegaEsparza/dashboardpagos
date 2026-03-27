# Payments Dashboard

Sistema de gestión de suscripciones y pagos con interfaz moderna, autenticación JWT segura y arquitectura optimizada.

---

## 🚀 Características

### Seguridad
- ✅ Autenticación JWT con refresh tokens
- ✅ Rate limiting contra fuerza bruta
- ✅ Sanitización de archivos subidos (MIME type + extensión)
- ✅ CORS configurado por entorno
- ✅ Variables de entorno para credenciales
- ✅ Row-level locking en transacciones críticas
- ✅ Password hashing con bcrypt

### Rendimiento
- ✅ Queries optimizadas (sin N+1)
- ✅ Paginación en listados
- ✅ Índices en base de datos
- ✅ Tokens con expiración automática
- ✅ Compresión y caché de assets

### UX
- ✅ Dark mode moderno con glassmorphism
- ✅ Feedback visual de errores
- ✅ Validación de formularios en tiempo real
- ✅ Auto-refresh de tokens
- ✅ Diseño responsive

---

## 📋 Requisitos

- Docker & Docker Compose
- Node.js 18+ (solo para desarrollo local)
- Git

---

## 🔧 Configuración

### 1. Clonar y configurar entorno

```bash
git clone <repository-url>
cd dashboardpagos

# Copiar configuración de ejemplo
cp .env.example .env

# Editar .env con tus valores seguros
nano .env
```

### 2. Configurar variables de entorno (.env)

```bash
# Database Configuration
MYSQL_ROOT_PASSWORD=tu_root_password_seguro
MYSQL_DATABASE=payments_db
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_password_seguro

# JWT Configuration - Generar con: openssl rand -base64 32
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro

# Environment
ENVIRONMENT=development

# CORS - URLs permitidas (separadas por coma)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

⚠️ **IMPORTANTE**: Nunca commitees el archivo `.env`. Ya está en `.gitignore`.

---

## 🐳 Despliegue con Docker

### Desarrollo

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Resetear base de datos (⚠️ Elimina todos los datos)
docker-compose down -v
docker-compose up -d
```

Servicios disponibles:
- Frontend: http://localhost:5173
- API: http://localhost:8080
- MySQL: localhost:3307

### Producción

```bash
# Generar JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# Configurar otras variables
export MYSQL_ROOT_PASSWORD=tu_password_seguro
export MYSQL_PASSWORD=tu_password_seguro
export ALLOWED_ORIGINS=https://tu-dominio.com

# Desplegar
docker-compose -f docker-compose.prod.yml up -d
```

---

## 👤 Credenciales por defecto

Al iniciar la base de datos por primera vez, se crea un usuario administrador:

- **Usuario**: `admin`
- **Password**: `admin123`

⚠️ **Cambiar inmediatamente después del primer login.**

Para cambiar el password:
1. Login como admin
2. Ir a base de datos o crear endpoint de cambio de password
3. Generar nuevo hash: `password_hash('nuevo_password', PASSWORD_BCRYPT)`

---

## 📁 Estructura del Proyecto

```
dashboardpagos/
├── public/
│   ├── api/                 # Endpoints PHP
│   │   ├── auth.php         # Autenticación JWT
│   │   ├── auth_middleware.php
│   │   ├── jwt.php          # Implementación JWT
│   │   ├── config.php       # Configuración central
│   │   ├── dashboard.php
│   │   ├── clients.php
│   │   ├── services.php
│   │   ├── products.php
│   │   ├── subscriptions.php
│   │   └── payments.php
│   ├── uploads/             # Archivos subidos
│   └── img/
├── src/
│   ├── contexts/
│   │   └── AuthContext.jsx  # Contexto de autenticación
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Clients.jsx
│   │   ├── Services.jsx
│   │   └── Subscriptions.jsx
│   ├── components/
│   ├── services/
│   │   └── api.js           # Servicio API con JWT
│   └── utils/
├── database/
│   └── schema.sql           # Esquema completo con usuarios
├── docker-compose.yml       # Configuración desarrollo
├── docker-compose.prod.yml  # Configuración producción
├── Dockerfile.frontend
├── Dockerfile.backend
└── nginx.conf
```

---

## 🔐 Seguridad Implementada

### Autenticación
- JWT con expiración de 15 minutos
- Refresh tokens con rotación (7 días)
- Blacklist de tokens revocados
- Rate limiting: 5 intentos cada 5 minutos

### Subida de Archivos
- Validación MIME type con finfo
- Límite de tamaño: 2MB imágenes, 5MB recibos
- Extensiones permitidas: jpg, png, gif, webp, pdf
- Nombres de archivo aleatorios (32 bytes)
- Directorios con permisos 0755, archivos 0644
- .htaccess para prevenir ejecución de scripts

### Base de Datos
- PDO con prepared statements (anti SQL injection)
- Transacciones para operaciones atómicas
- Row locking (FOR UPDATE) en pagos
- Índices en claves foráneas

### Headers de Seguridad
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## 🔌 API Endpoints

### Autenticación
```
POST /api/auth.php
  { action: "login", username, password }
  { action: "logout", refresh_token }
  { action: "refresh", refresh_token }

GET /api/auth.php  # Verificar token
```

### Recursos (requieren Bearer token)
```
GET    /api/clients.php?page=1&limit=20&search=term
POST   /api/clients.php          { name, email, phone }
PUT    /api/clients.php          { id, name, email, phone }
DELETE /api/clients.php?id=123

GET    /api/services.php?with_products=1
POST   /api/services.php         { name, description, image? }
PUT    /api/services.php         { id, name, description, image_url }
DELETE /api/services.php?id=123

GET    /api/products.php?service_id=123
POST   /api/products.php         { service_id, name, price, billing_cycle }
PUT    /api/products.php         { id, name, price, billing_cycle }
DELETE /api/products.php?id=123

GET    /api/subscriptions.php?page=1&limit=20&client_id=123&status=active
POST   /api/subscriptions.php    { client_id, product_id, start_date }
PUT    /api/subscriptions.php    { id, status, next_payment_date? }
DELETE /api/subscriptions.php?id=123

GET    /api/payments.php?subscription_id=123
POST   /api/payments.php         { subscription_id, amount, date, receipt? }

GET    /api/dashboard.php
```

---

## 📊 Optimizaciones Realizadas

### Backend
1. **N+1 Query Eliminado**: Endpoint `services.php?with_products=1` devuelve todo en una query
2. **Paginación**: Todos los listados soportan paginación configurable
3. **Transacciones**: Pagos con BEGIN TRANSACTION y row locking
4. **Índices**: Agregados en tablas de tokens y suscripciones

### Frontend
1. **Auto-refresh de tokens**: 1 minuto antes de expirar
2. **Context API**: Estado de autenticación centralizado
3. **Lazy loading**: Componentes cargados bajo demanda
4. **Debounced search**: Búsqueda con delay para reducir requests

---

## 🧪 Testing

```bash
# Test de autenticación
curl -X POST http://localhost:8080/api/auth.php \
  -H "Content-Type: application/json" \
  -d '{"action":"login","username":"admin","password":"admin123"}'

# Test con token
curl http://localhost:8080/api/dashboard.php \
  -H "Authorization: Bearer TU_TOKEN"
```

---

## 🚨 Troubleshooting

### Error: "Token expired"
El token JWT expira después de 15 minutos. El frontend debería auto-refrescar, pero si falla, hacer logout/login.

### Error: "Too many attempts"
Rate limiting activado. Esperar 5 minutos o reiniciar contador:
```bash
rm public/api/rate_limits/*.json
```

### Error: "Database connection failed"
Verificar:
1. Contenedor MySQL está corriendo: `docker-compose ps`
2. Variables de entorno correctas en `.env`
3. Red de Docker funcionando: `docker network ls`

### Archivos no se suben
Verificar permisos:
```bash
mkdir -p public/uploads/services public/uploads/receipts
chmod -R 755 public/uploads
```

---

## 📝 Changelog

### v2.0.0 - Security & Performance Update
- ✅ Implementado JWT authentication completo
- ✅ Agregado rate limiting
- ✅ Sanitización segura de archivos
- ✅ Variables de entorno para secrets
- ✅ CORS restringido por origen
- ✅ Eliminado N+1 query en servicios
- ✅ Paginación en todos los listados
- ✅ Índices en base de datos
- ✅ Row locking en transacciones de pagos
- ✅ Token rotation para refresh tokens
- ✅ Blacklist de tokens revocados

---

## 📄 Licencia

Proyecto privado. Todos los derechos reservados.

---

## 🤝 Soporte

Para reportar problemas de seguridad, contactar al equipo de desarrollo inmediatamente.

Para soporte técnico, revisar logs:
```bash
docker-compose logs -f api
docker-compose exec api tail -f /var/log/php_errors.log
```
