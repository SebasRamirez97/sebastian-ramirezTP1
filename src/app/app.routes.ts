import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HomeComponent } from './components/home/home.component';
//Para peliculas
import { CarteleraComponent } from './components/cartelera/cartelera';
import { CrearPeliculaComponent } from './components/crear-pelicula/crear-pelicula';
import { DetallePeliculaComponent } from './components/detalle-pelicula/detalle-pelicula';

//Para funciones
import { CrearFuncionComponent } from './components/crear-funcion/crear-funcion';
import { FuncionesPeliculaComponent } from './components/funciones-pelicula/funciones-pelicula';
import { ListaFuncionesComponent } from './components/lista-funciones/lista-funciones';
import { EditarFuncionComponent } from './components/editar-funcion/editar-funcion';

import { RegistrarEmpleadoComponent } from './components/registrar-empleado/registrar-empleado.componet';
import { VerificarEntradaComponent } from './components/verificar-entrada/verificar-entrada.component';

// 🔹 Importación de Funciones Guard
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { empleadoGuard } from './guards/empleado.guard';
import { clienteGuard } from './guards/cliente.guard';
import { loginGuard } from './guards/login.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [loginGuard] },

  { path: 'home', component: HomeComponent, canActivate: [authGuard] },

  // 🎬 Películas
  { path: 'cartelera', component: CarteleraComponent, canActivate: [authGuard] },
  { path: 'armar-cartelera', component: CrearPeliculaComponent, canActivate: [adminGuard] },
  { path: 'peliculas/:id', component: DetallePeliculaComponent, canActivate: [authGuard] },

  // Funciones de una pelicula
  { path: 'peliculas/:id/funciones', component: FuncionesPeliculaComponent, canActivate: [authGuard] },
  { path: 'lista-funciones', component: ListaFuncionesComponent,canActivate: [adminGuard] },
  { path: 'editar-funcion/:id', component: EditarFuncionComponent, canActivate: [adminGuard]}, // Protegida para que solo el admin pueda editar


  // 🍿 Funciones de Cine (Admin)
  { path: 'crear-funcion', component: CrearFuncionComponent, canActivate: [adminGuard] },

  // 🛠️ Admin
  { path: 'registrar-empleado', component: RegistrarEmpleadoComponent, canActivate: [adminGuard] },

  // 🍿 Empleado
  { path: 'verificar-entrada', component: VerificarEntradaComponent, canActivate: [empleadoGuard] },

  // 👤 Cliente
  { path: 'cliente-area', component: HomeComponent, canActivate: [clienteGuard] },

  // 🔄 Redirecciones
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];