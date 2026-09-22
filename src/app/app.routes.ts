import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HomeComponent } from './components/home/home.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { EmpleadoGuard } from './guards/empleado.guard';
import { ClienteGuard } from './guards/cliente.guard';

// Ejemplo de otros componentes
import { PeliculasComponent } from './components/peliculas/peliculas.component';
import { RegistrarEmpleadoComponent } from './components/registrar-empleado/registrar-empleado.componet';
import { VerificarEntradaComponent } from './components/verificar-entrada/verificar-entrada.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // Home accesible para cualquier sesión (cliente, admin, empleado, anónimo)
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },

  // Películas accesible para cliente, admin y anónimo
  { path: 'peliculas', component: PeliculasComponent, canActivate: [AuthGuard] },

  // Registrar empleado solo admin
  { path: 'registrar-empleado', component: RegistrarEmpleadoComponent, canActivate: [AdminGuard] },

  // Verificar entrada solo empleado
  { path: 'verificar-entrada', component: VerificarEntradaComponent, canActivate: [EmpleadoGuard] },

  // Ejemplo: ruta exclusiva cliente
  { path: 'cliente-area', component: HomeComponent, canActivate: [ClienteGuard] },

  // Redirección por defecto
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
