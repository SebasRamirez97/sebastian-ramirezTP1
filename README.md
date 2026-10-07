# 🎬 Sistema de Gestión de Cine - Documentación del Proyecto

Sistema web completo para la gestión de un complejo de cines, cartelera, venta de entradas con selección interactiva de asientos en tiempo real, tienda (Candy Bar), pasarela de pagos, roles de usuario diferenciados y control administrativo de funciones.

---

## 🚀 Características Implementadas (Estado Actual)

### 👥 1. Autenticación y Tipos de Usuarios
* **Registro de Clientes:** Los usuarios pueden registrarse en el sistema de forma tradicional.
* **Clientes Anónimos:** Acceso rápido sin registro previo; el sistema permite ingresar directamente indicando un nombre y mantiene el estado de sus selecciones locales.
* **Registro de Empleados:** Funcionalidad restringida donde solo el rol de administrador puede registrar nuevos empleados.
* **Control de Accesos (Login):** Todos los usuarios pasan por un flujo de autenticación, a excepción de los clientes anónimos.

### 🏠 2. Pantalla Principal (Home) y Cartelera
* **Home Dinámico:** Visualización destacada de las **3 películas más vistas** del sistema.
* **Cartelera:** Listado completo de películas disponibles.
* **Detalle y Funciones:** Cada película cuenta con una vista de detalles específica y acceso directo a sus funciones programadas.

### 🎟️ 3. Selección de Asientos y Flujo de Compra
* **Grilla Interactiva:** Selección visual de servicios, filas y bloques (con soporte para filas especiales como zonas de discapacidad o VIP usando directivas de atributo y control de flujo).
* **Sincronización en Tiempo Real:** Integración con WebSockets y base de datos para bloquear y liberar asientos de forma simultánea entre múltiples usuarios.
* **Límites de Selección:** Control dinámico de la cantidad de entradas permitidas por usuario.

### 🍿 4. Candy Bar y Checkout
* **Compra en el Candy Bar:** Los clientes pueden acceder de forma independiente o posterior a la selección de asientos para comprar productos de confitería.
* **Pasarela de Pago / Checkout:** Consolidación de la compra de entradas y productos.
* **Historial de Órdenes:** Los clientes pueden consultar el estado y detalle de sus compras anteriores ("Mis Órdenes").

### 🛠️ 5. Módulo de Administración y Empleados
* **Gestión de Funciones:** El administrador tiene permisos para editar y actualizar las funciones de las películas.
* **Verificador de Empleados:** Los empleados cuentan con herramientas para verificar y validar las compras realizadas por los clientes.

---

## 🚧 Cosas que Faltaron / Pendientes para Próximas Versiones

* [ ] **Contador de Vistas:** Desarrollo lógico del contador automático de visualizaciones para alimentar el ranking del Home.
* [ ] **Reseñas y Calificaciones:** Sistema para que los clientes puedan dejar comentarios, reseñas y otorgar un puntaje a las películas.
* [ ] **Atributos de Películas:** Incorporación de campos faltantes como **edad permitida** y **género**.
* [ ] **Buscador de Películas:** Implementación de un buscador interactivo en la cartelera.
* [ ] **Verificador de Edad:** Validación automática de la edad del cliente frente a la clasificación de la película seleccionada.
* [ ] **Panel de Estado del Cine:** Desarrollo del módulo administrativo para visualizar ganancias, métricas de ventas y todos los movimientos financieros en tiempo real.

---

## 💻 Tecnologías y Servicios Utilizados
* **Frontend:** Angular (con Control Flow `@if`, `@for` y directivas de atributo como `[ngClass]`)).
* **Base de Datos:** Supabase (Autenticación, Base de datos relacional PostgreSQL y canales en tiempo real).
* **Servicios Adicionales / Integraciones:** Firebase https://markacine.web.app/login.
* **Control de Versiones:** Git.
