import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  input,
  OnInit,
} from '@angular/core';
import { RolStaffService } from '../services/rol-staff.service';

type RolStaff = 'admin' | 'empleado';

@Directive({
  selector: '[appOcultarSiStaff]',
  standalone: true,
})
export class OcultarSiStaffDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private rolStaffService = inject(RolStaffService);

  // Input reactivo con signal
  rolesAOcultar = input<RolStaff[]>(['admin', 'empleado'], {
    alias: 'appOcultarSiStaff',
  });

  constructor() {
    effect(() => {
      const rolRaw = this.rolStaffService.tipoUsuario();
      const rolNormalizado = typeof rolRaw === 'string' ? rolRaw.toLowerCase().trim() : null;

      const inputRoles = this.rolesAOcultar();
      const rolesObjetivo: string[] =
        Array.isArray(inputRoles) && inputRoles.length > 0
          ? inputRoles.map((r) => r.toLowerCase().trim())
          : ['admin', 'empleado'];

      const debeOcultar =
        rolNormalizado !== null && rolesObjetivo.includes(rolNormalizado);

      if (debeOcultar) {
        if (this.viewContainer.length > 0) {
          this.viewContainer.clear();
        }
      } else {
        if (this.viewContainer.length === 0) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        }
      }
    });
  }

  async ngOnInit() {
    if (this.rolStaffService.tipoUsuario() === null) {
      await this.rolStaffService.verificarRolActual();
    }
  }
}