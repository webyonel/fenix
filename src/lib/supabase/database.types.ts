export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			busy_dates: {
				Row: { date: string; created_at: string };
				Insert: { date: string; created_at?: string };
				Update: { date?: string; created_at?: string };
				Relationships: [];
			};
			gallery_items: {
				Row: { id: string; image_path: string; alt_text: string; position: number; created_at: string };
				Insert: { id?: string; image_path: string; alt_text?: string; position?: number; created_at?: string };
				Update: { id?: string; image_path?: string; alt_text?: string; position?: number; created_at?: string };
				Relationships: [];
			};
			plan_categories: {
				Row: { slug: string; name: string; cover_path: string; position: number; updated_at: string };
				Insert: { slug: string; name: string; cover_path: string; position: number; updated_at?: string };
				Update: { slug?: string; name?: string; cover_path?: string; position?: number; updated_at?: string };
				Relationships: [];
			};
			plans: {
				Row: { id: string; category_slug: string; name: string; description: string; features: string[]; price_usd: number; image_path: string; position: number; created_at: string; updated_at: string };
				Insert: { id?: string; category_slug: string; name: string; description: string; features?: string[]; price_usd: number; image_path: string; position?: number; created_at?: string; updated_at?: string };
				Update: { id?: string; category_slug?: string; name?: string; description?: string; features?: string[]; price_usd?: number; image_path?: string; position?: number; created_at?: string; updated_at?: string };
				Relationships: [{ foreignKeyName: 'plans_category_slug_fkey'; columns: ['category_slug']; isOneToOne: false; referencedRelation: 'plan_categories'; referencedColumns: ['slug'] }];
			};
			products: {
				Row: { id: string; name: string; description: string; price_usd: number; image_path: string; position: number; created_at: string; updated_at: string };
				Insert: { id?: string; name: string; description: string; price_usd: number; image_path: string; position?: number; created_at?: string; updated_at?: string };
				Update: { id?: string; name?: string; description?: string; price_usd?: number; image_path?: string; position?: number; updated_at?: string };
				Relationships: [];
			};
			site_settings: {
				Row: { id: boolean; hero_title_line: string; hero_title_emphasis: string; hero_text_color: string; hero_image_path: string; hero_image_alt: string; about_paragraphs: string[]; about_image_path: string; about_image_alt: string; cup_per_usd: number; products_card_image_path: string; products_card_image_alt: string; updated_at: string };
				Insert: { id?: boolean; hero_title_line?: string; hero_title_emphasis?: string; hero_text_color?: string; hero_image_path?: string; hero_image_alt?: string; about_paragraphs?: string[]; about_image_path?: string; about_image_alt?: string; cup_per_usd?: number; products_card_image_path?: string; products_card_image_alt?: string; updated_at?: string };
				Update: { id?: boolean; hero_title_line?: string; hero_title_emphasis?: string; hero_text_color?: string; hero_image_path?: string; hero_image_alt?: string; about_paragraphs?: string[]; about_image_path?: string; about_image_alt?: string; cup_per_usd?: number; products_card_image_path?: string; products_card_image_alt?: string; updated_at?: string };
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: { is_site_admin: { Args: Record<PropertyKey, never>; Returns: boolean } };
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

export type Tables<Name extends keyof Database['public']['Tables']> = Database['public']['Tables'][Name]['Row'];
export type TablesInsert<Name extends keyof Database['public']['Tables']> = Database['public']['Tables'][Name]['Insert'];
export type TablesUpdate<Name extends keyof Database['public']['Tables']> = Database['public']['Tables'][Name]['Update'];
