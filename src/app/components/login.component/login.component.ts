import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-login.component',
  styleUrl: './login.component.css',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  nombreAnonimo = '';

  constructor(private authService: AuthService, private router: Router) {}

  async login() {
    try {
      // 1. Intentar login con Supabase (clientes)
    const res = await this.authService.signIn(this.email, this.password);

    if (res.user) {
      // Cliente registrado → va a /inicio
      this.router.navigate(['/inicio']);
      return;
    }

    // 2. Si no es cliente, consultar tabla empleados/admin
    // Supongamos que tenés un método en AuthService que busca en tu tabla
    const usuario = await this.authService.loginPersonal(this.email, this.password);

    if (usuario) {
      if (usuario.rol === 'admin') {
        this.router.navigate(['/inicioAdmin']);
      } else if (usuario.rol === 'empleado') {
        this.router.navigate(['/inicioEmpleado']);
      } else {
        alert('Rol no reconocido');
      }
    } else {
      alert('Credenciales inválidas');
    }

  } catch (err: any) {
    console.error('Error en login:', err.message);
  }
  }

  loginAnonimo() {
    const clienteAnonimo = { nombre: this.nombreAnonimo, tipo: 'anonimo' };
    localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
    this.router.navigate(['/inicio']); // redirige a la página de inicio
  }
}
