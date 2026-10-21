import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registrar-empleado',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './registrar-empleado.component.html',
  styleUrls: ['./registrar-empleado.component.css']
})
export class RegistrarEmpleadoComponent {
  // 🔹 Inyección moderna con inject()
  private authService = inject(AuthService);
  private router = inject(Router);

  // 🔹 Formulario exclusivo para empleados (email, password, nombre, apellido)
  formEmpleado = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    apellido: new FormControl('', [Validators.required])
  });

  // 🔹 Estado con Signals
  submitted = signal<boolean>(false);

  async registrarEmpleado(): Promise<void> {
    this.submitted.set(true);
    if (this.formEmpleado.invalid) {
      this.formEmpleado.markAllAsTouched();
      return;
    }

    try {
      const empleadoData = this.formEmpleado.value as { email: string; password: string; nombre: string; apellido: string };
      const res = await this.authService.signUpEmpleado(empleadoData);
      console.log('Empleado registrado exitosamente:', res);
      alert('¡Empleado registrado con éxito!');
      
      this.formEmpleado.reset();
      this.submitted.set(false);
    } catch (err: any) {
      console.error('Error al registrar empleado:', err.message);
      alert('Error al registrar empleado: ' + err.message);
    }
  }

  volver(): void {
    this.formEmpleado.reset();
    this.submitted.set(false);
    this.router.navigate(['/home']); 
  }
}