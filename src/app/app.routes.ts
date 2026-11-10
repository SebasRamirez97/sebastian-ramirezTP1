import { Routes } from '@angular/router';

// 🔹 Importación de Funciones Guard
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { empleadoGuard } from './guards/empleado.guard';
import { clienteGuard } from './guards/cliente.guard';
import { loginGuard } from './guards/login.guard';
import { liberarAsientosGuard } from './guards/liberar-asientos.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent), 
    canActivate: [loginGuard] 
  },
  { 
    path: 'register', 
    loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent), 
    canActivate: [loginGuard] 
  },

  { 
    path: 'home', 
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent), 
    canActivate: [authGuard] 
  },

  // 🎬 Películas
  { 
    path: 'cartelera', 
    loadComponent: () => import('./components/cartelera/cartelera').then(m => m.CarteleraComponent), 
    canActivate: [authGuard] 
  },
  { 
    path: 'armar-cartelera', 
    loadComponent: () => import('./components/crear-pelicula/crear-pelicula').then(m => m.CrearPeliculaComponent), 
    canActivate: [adminGuard] 
  },
  { 
    path: 'peliculas/:id', 
    loadComponent: () => import('./components/detalle-pelicula/detalle-pelicula').then(m => m.DetallePeliculaComponent), 
    canActivate: [authGuard] 
  },

  // Candy-Bar
  { 
    path: 'candybar', 
    loadComponent: () => import('./components/candy-bar/candy-bar').then(m => m.CandyBarComponent), 
    canActivate: [authGuard],
    canDeactivate: [liberarAsientosGuard]
  },
  { 
    path: 'crear-producto', 
    loadComponent: () => import('./components/crear-producto/crear-producto').then(m => m.CrearProductoComponent), 
    canActivate: [adminGuard] 
  },

  // 🎟️ Gestión de Cupones (Admin) 👈 NUEVA RUTA
  { 
    path: 'gestionar-cupones', 
    loadComponent: () => import('./components/gestion-cupones/gestion-cupones').then(m => m.GestionCuponesComponent), 
    canActivate: [adminGuard] 
  },

  // Funciones de una pelicula
  { 
    path: 'peliculas/:id/funciones', 
    loadComponent: () => import('./components/funciones-pelicula/funciones-pelicula').then(m => m.FuncionesPeliculaComponent), 
    canActivate: [authGuard] 
  },
  { 
    path: 'lista-funciones', 
    loadComponent: () => import('./components/lista-funciones/lista-funciones').then(m => m.ListaFuncionesComponent),
    canActivate: [adminGuard] 
  },
  { 
    path: 'editar-funcion/:id', 
    loadComponent: () => import('./components/editar-funcion/editar-funcion').then(m => m.EditarFuncionComponent), 
    canActivate: [adminGuard]
  },

  // Para entradas de cine
  { 
    path: 'seleccionar-asientos/:funcionId', 
    loadComponent: () => import('./components/seleccionar-asientos/seleccionar-asientos').then(m => m.SeleccionarAsientosComponent), 
    canActivate: [authGuard],
    canDeactivate: [liberarAsientosGuard]
  },
  { 
    path: 'checkout/:funcionId', 
    loadComponent: () => import('./components/checkout/checkout').then(m => m.CheckoutComponent), 
    canActivate: [authGuard],
    canDeactivate: [liberarAsientosGuard]
  },
  { 
    path: 'checkout',  
    loadComponent: () => import('./components/checkout/checkout').then(m => m.CheckoutComponent), 
    canActivate: [authGuard],
    canDeactivate: [liberarAsientosGuard]
  },

  // 🍿 Funciones de Cine (Admin)
  { 
    path: 'crear-funcion', 
    loadComponent: () => import('./components/crear-funcion/crear-funcion').then(m => m.CrearFuncionComponent), 
    canActivate: [adminGuard] 
  },

  // 🛠️ Admin
  { 
    path: 'registrar-empleado', 
    loadComponent: () => import('./components/registrar-empleado/registrar-empleado.component').then(m => m.RegistrarEmpleadoComponent), 
    canActivate: [adminGuard] 
  },

  // 🍿 Empleado
  { 
    path: 'verificar-orden', 
    loadComponent: () => import('./components/verificar-orden/verificar-orden.component').then(m => m.VerificarOrdenComponent), 
    canActivate: [empleadoGuard] 
  },

  // 👤 Cliente
  { 
    path: 'cliente-area', 
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent), 
    canActivate: [clienteGuard] 
  },
  { 
    path: 'estado-cliente', 
    loadComponent: () => import('./components/estado-cliente/estado-cliente').then(m => m.EstadoClienteComponent), 
    canActivate: [clienteGuard] 
  },
  { 
    path: 'cargar-saldo', 
    loadComponent: () => import('./components/cargar-saldo/cargar-saldo').then(m => m.CargarSaldoComponent), 
    canActivate: [clienteGuard] 
  },
  { 
    path: 'mis-ordenes', 
    loadComponent: () => import('./components/mis-ordenes/mis-ordenes').then(m => m.MisOrdenesComponent), 
    canActivate: [clienteGuard] 
  },

  // 🔄 Redirecciones
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];