import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha';

export function mayorDeEdadValidator(edadMinima: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const fechaNacimiento = new Date(control.value);
    const hoy = new Date();

    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }

    return edad >= edadMinima ? null : { menorDeEdad: true };
  };
}

// 🌟 Validador personalizado para comprobar que las contraseñas coinciden
export const passwordsCoincidenValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { noCoinciden: true };
  }
  return null;
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, SelectorFechaComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent { 
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal<boolean>(false);

  // 🌟 Agregamos confirmPassword al FormGroup y el validador a nivel de grupo
  formCliente = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
    apellido: new FormControl('', [Validators.required]),
    fechaNacimiento: new FormControl('', [Validators.required, mayorDeEdadValidator(13)]),
    tipoSangre: new FormControl('', [Validators.required]),
    colorOjos: new FormControl('', [Validators.required]),
    vacaciones: new FormControl('', [Validators.required, Validators.min(0)])
  }, { validators: passwordsCoincidenValidator }); // 👈 Validación cruzada aplicada aquí

  async registrarCliente(): Promise<void> {
    this.submitted.set(true);

    if (this.formCliente.invalid) {
      this.formCliente.markAllAsTouched();
      return;
    }

    try {
      // Extraemos confirmPassword para no enviarlo a la base de datos si no es necesario
      const { confirmPassword, ...clienteData } = this.formCliente.value;
      const res = await this.authService.signUpCliente(clienteData as any);
      console.log('Cliente registrado:', res);
      this.router.navigate(['/login']);
    } catch (err: any) {
      console.error('Error en registro:', err.message);
      alert('Error al registrar cliente');
    }
  }

  volverAlLogin(): void {
    this.submitted.set(false);
    this.formCliente.reset();
    this.router.navigate(['/login']);
  }
}