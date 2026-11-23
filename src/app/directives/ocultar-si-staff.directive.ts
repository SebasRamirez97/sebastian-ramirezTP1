import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  Input,
  OnInit,
} from '@angular/core';
import { RolStaffService } from '../services/rol-staff.service';

@Directive({
  selector: '[appOcultarSiStaff]',
  standalone: true,
})
export class OcultarSiStaffDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private rolStaffService = inject(RolStaffService);

  // Opcional: si pasás ['admin'], solo oculta para admin; por defecto oculta para 'admin' y 'empleado'
  @Input('appOcultarSiStaff') rolesAOcultar: Array<'admin' | 'empleado'> = ['admin', 'empleado'];

  private vistaCreada = false;

  constructor() {
    // Reacciona automáticamente cuando cambia la signal tipoUsuario
    effect(() => {
      const rolActual = this.rolStaffService.tipoUsuario();
      const rolesObjetivo =
        Array.isArray(this.rolesAOcultar) && this.rolesAOcultar.length > 0
          ? this.rolesAOcultar
          : (['admin', 'empleado'] as const);

      const debeOcultar = rolActual !== null && rolesObjetivo.includes(rolActual as any);

      if (debeOcultar) {
        this.viewContainer.clear();
        this.vistaCreada = false;
      } else if (!this.vistaCreada) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.vistaCreada = true;
      }
    });
  }

  async ngOnInit() {
    // Si aún no se consultó el rol en esta sesión, lo consultamos
    if (this.rolStaffService.tipoUsuario() === null) {
      await this.rolStaffService.verificarRolActual();
    }
  }
}