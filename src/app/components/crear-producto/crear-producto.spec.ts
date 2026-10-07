import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearProducto } from './crear-producto';

describe('CrearProducto', () => {
  let component: CrearProducto;
  let fixture: ComponentFixture<CrearProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearProducto],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearProducto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
