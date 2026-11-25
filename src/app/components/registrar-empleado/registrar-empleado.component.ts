import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RolesPermisosService, RolItem } from '../../services/roles-permisos.service';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registrar-empleado',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './registrar-empleado.component.html',
  styleUrls: ['./registrar-empleado.component.css'],
})
export class RegistrarEmpleadoComponent implements OnInit {
  private authService = inject(AuthService);
  private rolesPermisosService = inject(RolesPermisosService);
  private router = inject(Router);

  formEmpleado = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    apellido: new FormControl('', [Validators.required]),
    rol_id: new FormControl<string>('', [Validators.required]),
  });

  roles = signal<RolItem[]>([]);
  cargandoRoles = signal<boolean>(true);
  submitted = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.cargarRoles();
  }

  async cargarRoles(): Promise<void> {
    this.cargandoRoles.set(true);
    try {
      const lista = await this.rolesPermisosService.obtenerRoles();
      this.roles.set(lista);
      if (lista.length > 0 && !this.formEmpleado.get('rol_id')?.value) {
        this.formEmpleado.patchValue({ rol_id: lista[0].id });
      }
    } catch (err: any) {
      console.error('Error al cargar roles:', err.message);
    } finally {
      this.cargandoRoles.set(false);
    }
  }

  async registrarEmpleado(): Promise<void> {
    this.submitted.set(true);
    if (this.formEmpleado.invalid) {
      this.formEmpleado.markAllAsTouched();
      return;
    }

    try {
      const empleadoData = this.formEmpleado.value as {
        email: string;
        password: string;
        nombre: string;
        apellido: string;
        rol_id: string;
      };

      const res: any = await this.authService.signUpEmpleado(empleadoData);

      const empleadoId =
        res?.id ||
        res?.user?.id ||
        res?.data?.user?.id ||
        res?.data?.id ||
        null;

      if (empleadoId && empleadoData.rol_id) {
        await this.rolesPermisosService.asignarRolAEmpleado(empleadoId, empleadoData.rol_id);
      }

      console.log('Empleado registrado exitosamente:', res);
      alert('¡Empleado registrado y rol asignado con éxito!');

      const rolPorDefecto = this.roles()[0]?.id ?? '';
      this.formEmpleado.reset({ rol_id: rolPorDefecto });
      this.submitted.set(false);
    } catch (err: any) {
      console.error('Error al registrar empleado:', err.message);
      alert('Error al registrar empleado: ' + err.message);
    }
  }

  volver(): void {
    const rolPorDefecto = this.roles()[0]?.id ?? '';
    this.formEmpleado.reset({ rol_id: rolPorDefecto });
    this.submitted.set(false);
    this.router.navigate(['/home']);
  }
}