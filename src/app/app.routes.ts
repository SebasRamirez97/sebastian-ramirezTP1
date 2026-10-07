import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HomeComponent } from './components/home/home.component';
//Para peliculas
import { CarteleraComponent } from './components/cartelera/cartelera';
import { CrearPeliculaComponent } from './components/crear-pelicula/crear-pelicula';
import { DetallePeliculaComponent } from './components/detalle-pelicula/detalle-pelicula';

//Para CandyBar
import { CrearProductoComponent } from './components/crear-producto/crear-producto';
import { CandyBarComponent } from './components/candy-bar/candy-bar'; // (O la ruta donde tengas tu vista de cliente/admin de productos)
//Para funciones
import { CrearFuncionComponent } from './components/crear-funcion/crear-funcion';
import { FuncionesPeliculaComponent } from './components/funciones-pelicula/funciones-pelicula';
import { ListaFuncionesComponent } from './components/lista-funciones/lista-funciones';
import { EditarFuncionComponent } from './components/editar-funcion/editar-funcion';

import { RegistrarEmpleadoComponent } from './components/registrar-empleado/registrar-empleado.componet';

//Para compras de entrada
import { SeleccionarAsientosComponent } from './components/seleccionar-asientos/seleccionar-asientos';
import { CheckoutComponent } from './components/checkout/checkout';
import { VerificarEntradaComponent } from './components/verificar-entrada/verificar-entrada.component'; //proximamente

//Para Cliente
import { EstadoClienteComponent } from './components/estado-cliente/estado-cliente';
import { CargarSaldoComponent } from './components/cargar-saldo/cargar-saldo';
import { MisOrdenesComponent } from './components/mis-ordenes/mis-ordenes';

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

  // Candy-Bar
  { path: 'candybar', component: CandyBarComponent, canActivate: [authGuard] },
  { path: 'crear-producto', component: CrearProductoComponent, canActivate: [adminGuard] },
 

  // Funciones de una pelicula
  { path: 'peliculas/:id/funciones', component: FuncionesPeliculaComponent, canActivate: [authGuard] },
  { path: 'lista-funciones', component: ListaFuncionesComponent,canActivate: [adminGuard] },
  { path: 'editar-funcion/:id', component: EditarFuncionComponent, canActivate: [adminGuard]}, // Protegida para que solo el admin pueda editar

  //Para entradas de cine

  { path: 'seleccionar-asientos/:funcionId', component: SeleccionarAsientosComponent, canActivate: [authGuard]},
  { path: 'checkout/:funcionId', component: CheckoutComponent, canActivate: [authGuard]},
  {path: 'checkout',  component: CheckoutComponent, canActivate: [authGuard]},   // 👈 Ruta exclusiva para cuando es solo candy bar sin función


  // 🍿 Funciones de Cine (Admin)
  { path: 'crear-funcion', component: CrearFuncionComponent, canActivate: [adminGuard] },

  // 🛠️ Admin
  { path: 'registrar-empleado', component: RegistrarEmpleadoComponent, canActivate: [adminGuard] },

  // 🍿 Empleado
  { path: 'verificar-entrada', component: VerificarEntradaComponent, canActivate: [empleadoGuard] },

  // 👤 Cliente
  { path: 'cliente-area', component: HomeComponent, canActivate: [clienteGuard] },
  { path: 'estado-cliente', component: EstadoClienteComponent, canActivate: [clienteGuard] },
  { path: 'cargar-saldo', component: CargarSaldoComponent, canActivate: [clienteGuard] },
  { path: 'mis-ordenes', component: MisOrdenesComponent, canActivate: [clienteGuard] },

  // 🔄 Redirecciones
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];