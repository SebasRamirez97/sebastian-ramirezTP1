import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';


@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-registro',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegistroComponent {
  cliente = {
    email: '',
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    tipoSangre: '',
    colorOjos: '',
    vacaciones: 0,
    password: '' // también necesitas contraseña
  };

  constructor(private authService: AuthService, private router: Router) {}

  async registrarCliente() {
    try {
      const res = await this.authService.signUp(this.cliente);
      console.log('Cliente registrado:', res);
      this.router.navigate(['/inicio']);
    } catch (err: any) {
      console.error('Error en registro:', err.message);
    }
  }
}
