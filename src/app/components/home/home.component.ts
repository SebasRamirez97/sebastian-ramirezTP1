import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';


@Component({
  imports: [CommonModule],
  standalone: true,
  selector: 'app-home',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent {}
