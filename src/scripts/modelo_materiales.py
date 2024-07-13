import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from xgboost import XGBRegressor
from mlforecast import MLForecast
from window_ops.rolling import rolling_mean, rolling_max, rolling_min
from window_ops.ewm import ewm_mean
import sys
import json




def ejecutar_modelo(material, lag1, lag2, rolm):
    # Crear la cadena de conexión usando las variables de entorno
    engine = create_engine('mysql+pymysql://root:Udla1@localhost:3306/wst')

    query_materiales = 'SELECT id AS MaterialID, name, quantity AS Stock FROM materiales'
    df_materiales = pd.read_sql(query_materiales, engine)

    query_ticket_materiales = 'SELECT material_id AS MaterialID, fecha, cantidad AS Demand, stock_anterior, stock_actual FROM ticket_materiales'
    df_ticket_materiales = pd.read_sql(query_ticket_materiales, engine)
    
    df_ticket_materiales['fecha'] = pd.to_datetime(df_ticket_materiales['fecha'])
    df_ticket_materiales['stock_anterior'] = df_ticket_materiales['stock_anterior'].astype(float)
    df_ticket_materiales['stock_actual'] = df_ticket_materiales['stock_actual'].astype(float)
    df_ticket_materiales['Demand'] = df_ticket_materiales['Demand'].astype(float)
    df_ticket_materiales['YearMonth'] = df_ticket_materiales['fecha'].dt.to_period('M').dt.to_timestamp()
    df_monthly_demand = df_ticket_materiales.groupby(['MaterialID', 'YearMonth'])['Demand'].sum().reset_index()
    df_ticket_materiales['RealUsage'] = df_ticket_materiales['stock_anterior'] - df_ticket_materiales['stock_actual']
    df_real_usage = df_ticket_materiales.groupby(['MaterialID', 'YearMonth'])['RealUsage'].sum().reset_index()
    df = pd.merge(df_monthly_demand, df_materiales, on='MaterialID')
    df = pd.merge(df, df_real_usage, on=['MaterialID', 'YearMonth'], how='left')
    df_model = df[['MaterialID', 'YearMonth', 'Demand', 'RealUsage', 'Stock']].copy()
    df_model.dropna(inplace=True)
    train_data = df_model[df_model['YearMonth'] < pd.to_datetime('today') - pd.DateOffset(months=1)]
    validation_data = df_model[df_model['YearMonth'] == pd.to_datetime('today') - pd.DateOffset(months=1)]

    def plot(material, lag1, lag2, rolm):
        material_id = df_materiales[df_materiales['name'] == material]['MaterialID'].values[0]
        train = train_data[train_data['MaterialID'] == material_id]

        if train.empty:
            return {"error": f"No hay datos suficientes para entrenar el modelo para el material {material}"}

        max_lag = max(lag1, lag2, rolm)
        if len(train) <= max_lag:
            return {"error": f"El número de datos ({len(train)}) es insuficiente para el valor máximo de lag/rolm ({max_lag})."}

        models = [make_pipeline(SimpleImputer(strategy='mean'), RandomForestRegressor(random_state=0, n_estimators=100)), XGBRegressor(random_state=0, n_estimators=100)]

        model = MLForecast(models=models, freq='ME', lags=[lag1, lag2], lag_transforms={lag1: [(rolling_mean, rolm), (rolling_min, rolm), (rolling_max, rolm)], lag2: [(ewm_mean, 0.5)]}, num_threads=6)
        
        try:
            model.fit(train, id_col='MaterialID', time_col='YearMonth', target_col='Demand')
        except Exception as e:
            return {"error": f"Error al ajustar el modelo: {str(e)}"}

        h = 3
        try:
            predictions = model.predict(h=h)
        except Exception as e:
            return {"error": f"Error al predecir: {str(e)}"}

        predictions['name'] = material
        predictions['YearMonth'] = pd.date_range(start=pd.to_datetime('today').replace(day=1), periods=h, freq='ME')
        validation = validation_data[validation_data['MaterialID'] == material_id]
        validation = validation.set_index('YearMonth')
        predictions = predictions.set_index('YearMonth')

        combined_df = pd.concat([train.set_index('YearMonth')['Demand'], validation['Demand'], predictions[['RandomForestRegressor', 'XGBRegressor']]])
        combined_df.index = pd.to_datetime(combined_df.index)
        combined_df = combined_df.drop(columns=['MaterialID'], errors='ignore')

        material_name = df_materiales[df_materiales['MaterialID'] == material_id]['name'].values[0]

        combined_df.reset_index(inplace=True)
        combined_df['YearMonth'] = combined_df['YearMonth'].astype(str)
        combined_df = combined_df.replace({np.nan: None})
        predictions.reset_index(inplace=True)
        predictions['YearMonth'] = predictions['YearMonth'].astype(str)
        predictions = predictions.replace({np.nan: None})

        results = {
            "material_name": material_name,
            "combined_data": combined_df.to_dict(orient='list'),
            "predictions": predictions.to_dict(orient='list')
        }
        
        return results

    results = plot(material, int(lag1), int(lag2), int(rolm))
    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(json.dumps({"error": "Se requieren exactamente 4 argumentos: material, lag1, lag2, rolm"}))
    else:
        ejecutar_modelo(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
