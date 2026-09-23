import { Component, Input } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() rol: string = ''; // rol recibido desde Home o App

  constructor(private authService: AuthService, private router: Router) {}

  cerrarSesion() {
    this.authService.signOut();
    localStorage.removeItem('rol')
    this.router.navigate(['/login']);
  }

  salirAnonimo() {
    this.authService.signOutAnonimo();
    localStorage.removeItem('rol');
    this.router.navigate(['/login']);
  }
}