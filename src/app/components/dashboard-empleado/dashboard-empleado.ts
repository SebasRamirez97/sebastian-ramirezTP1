import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CATALOGO_PERMISOS,
  ClavePermiso,
  DefinicionPermiso,
  EmpleadoConRol,
  RolItem,
  RolesPermisosService,
} from '../../services/roles-permisos.service';

@Component({
  selector: 'app-dashboard-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard-empleado.html',
  styleUrl: './dashboard-empleado.css',
})
export class DashboardEmpleadoComponent implements OnInit {
  private rolesService = inject(RolesPermisosService);

  cargando = signal<boolean>(true);
  permisos = signal<ClavePermiso[]>([]);
  esAdmin = signal<boolean>(false);

  roles = signal<RolItem[]>([]);
  empleados = signal<EmpleadoConRol[]>([]);
  seleccionRolPorEmpleado: Record<string, string> = {};
  mensajeAsignacion = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  accesosHabilitados = computed<DefinicionPermiso[]>(() => {
    const habilitados = new Set(this.permisos());
    return CATALOGO_PERMISOS.filter((item) => habilitados.has(item.clave));
  });

  async ngOnInit(): Promise<void> {
    await this.cargarDashboard();
  }

  async cargarDashboard(): Promise<void> {
    this.cargando.set(true);
    try {
      const res = await this.rolesService.cargarPermisosUsuarioActual();
      this.esAdmin.set(res.esAdmin);
      this.permisos.set(res.permisos);

      const [listaRoles, listaEmpleados] = await Promise.all([
        this.rolesService.obtenerRoles(),
        this.rolesService.obtenerEmpleadosConRoles(),
      ]);

      this.roles.set(listaRoles);
      this.empleados.set(listaEmpleados);

      const mapa: Record<string, string> = {};
      for (const emp of listaEmpleados) {
        mapa[emp.id] = emp.rol_id || '';
      }
      this.seleccionRolPorEmpleado = mapa;
    } finally {
      this.cargando.set(false);
    }
  }

  async asignarRol(empleadoId: string): Promise<void> {
    const rolId = this.seleccionRolPorEmpleado[empleadoId] || null;

    this.mensajeAsignacion.set(null);
    try {
      await this.rolesService.asignarRolAEmpleado(empleadoId, rolId);
      this.mensajeAsignacion.set({ tipo: 'ok', texto: 'Rol asignado correctamente.' });
      await this.cargarDashboard();
    } catch (e: any) {
      this.mensajeAsignacion.set({ tipo: 'err', texto: e.message });
    }
  }
}