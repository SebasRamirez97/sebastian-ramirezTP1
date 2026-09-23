import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  nombreAnonimo: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  async login() {
    try {
      // 🔹 Login único con Supabase Auth
      const result = await this.authService.signIn(this.email, this.password);

      if (result?.user) {
        localStorage.removeItem('clienteAnonimo'); // limpiar estado anónimo

        // 🔹 Leer rol desde metadata
        const rol = result.user.user_metadata?.['rol'];
        if (rol) {
           localStorage.setItem('rol', rol);
        }
        if (rol === 'admin') {
          this.router.navigate(['/home']); // Home mostrará sección admin
        } else if (rol === 'empleado') {
          this.router.navigate(['/home']); // Home mostrará sección empleado
        } else if (rol === 'cliente') {
          this.router.navigate(['/home']); // Home mostrará sección cliente
        } else {
          alert('Rol no reconocido');
        }
        return;
      }

      alert('Credenciales inválidas');
    } catch (err: any) {
      console.error('Error en login:', err.message);
      alert('Error al iniciar sesión');
    }
  }

  loginAnonimo() {
    const cliente = this.authService.loginAnonimo(this.nombreAnonimo);
    if (!cliente) {
      alert('Debes ingresar un nombre para continuar como invitado.');
      return;
    }
    localStorage.setItem('rol', cliente.rol);
    this.router.navigate(['/home']); // Home mostrará sección anónimo
  }

  irARegistro() {
    this.router.navigate(['/register']);
  }
}
