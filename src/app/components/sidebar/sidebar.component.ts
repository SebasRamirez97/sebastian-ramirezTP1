import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ClavePermiso, RolesPermisosService } from '../../services/roles-permisos.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private rolesPermisosService = inject(RolesPermisosService);
  private router = inject(Router);

  rol = signal<string>('');
  permisosEmpleado = signal<ClavePermiso[]>([]);
  private rolSub!: Subscription;

  tienePeliculas = computed(() => this.permisosEmpleado().includes('peliculas'));
  tieneCandyBar = computed(() => this.permisosEmpleado().includes('candybar'));
  tienePromociones = computed(() => this.permisosEmpleado().includes('promociones'));
  tieneReportes = computed(() => this.permisosEmpleado().includes('reportes'));
  tieneVerificarOrden = computed(() => this.permisosEmpleado().includes('verificar_orden'));

  ngOnInit(): void {
    this.rolSub = this.authService.rol$.subscribe(async (nuevoRol) => {
      this.rol.set(nuevoRol);

      if (nuevoRol === 'empleado') {
        const estado = await this.rolesPermisosService.cargarPermisosUsuarioActual();
        this.permisosEmpleado.set(estado.permisos);
      } else {
        this.permisosEmpleado.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.rolSub) {
      this.rolSub.unsubscribe();
    }
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.signOut();
    this.permisosEmpleado.set([]);
    this.router.navigate(['/login']);
  }

  salirAnonimo(): void {
    this.authService.signOutAnonimo();
    this.router.navigate(['/login']);
  }
}